-- =========================================================
-- KRİTİK GÜVENLİK DÜZELTMESİ: PL/pgSQL'de `IF NOT (<ifade>) THEN
-- raise exception ... END IF;` deseninde <ifade> NULL'a
-- değerlendirilirse (örn. sales_user_id/first_call_user_id/
-- assigned_employee_id gibi nullable bir kolonla auth.uid()
-- karşılaştırması NULL sonucu verirse), `NOT NULL` = NULL olur ve
-- `IF NULL THEN` hiç çalışmaz — yani exception RAISE EDİLMEZ,
-- yetkisiz çağrı sessizce devam eder.
--
-- Test sırasında respond_to_referral'da yakalandı: bir partner
-- çalışanı kendisine atanmamış (assigned_employee_id = null) bir
-- yönlendirmeyi başarıyla kabul edebildi. Aynı desen
-- assign_lead_to_sales, assign_lead_to_partner'daki yetki
-- kontrollerinde ve soft_delete_lead/set_user_role/set_user_active
-- fonksiyonlarındaki `current_role() <> 'pv_admin'` kontrollerinde de
-- mevcuttu (current_role() rolsüz/pasif kullanıcı için NULL döner).
--
-- Düzeltme: tüm OR zincirleri coalesce(..., false) ile sarmalandı;
-- tüm `<> 'pv_admin'` karşılaştırmaları `is distinct from 'pv_admin'`
-- ile değiştirildi (bu operatör NULL'ı doğru şekilde "farklı" sayar).
-- RLS policy'lerindeki (USING/WITH CHECK) benzer ifadeler bu hatadan
-- ETKİLENMEZ — orada NULL zaten satırı güvenli şekilde dışlar; sorun
-- yalnızca bu RPC'lerin imperatif IF/THEN gövdelerinde.
-- =========================================================

create or replace function public.soft_delete_lead(
  p_lead_id uuid,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old public.leads;
begin
  if private.current_role() is distinct from 'pv_admin' then
    raise exception 'Lead silme yetkisi yalnızca pv_admin''e aittir';
  end if;

  select * into v_old from public.leads where id = p_lead_id;
  if v_old is null then
    raise exception 'Lead bulunamadı';
  end if;

  perform set_config('app.bypass_lead_protection', 'on', true);

  update public.leads
  set deleted_at = now(), deleted_by = auth.uid()
  where id = p_lead_id;

  perform private.write_audit_log(
    'soft_delete', 'leads', p_lead_id,
    to_jsonb(v_old), null, p_reason
  );
end;
$$;

create or replace function public.set_user_role(
  p_user_id uuid,
  p_role public.app_role
)
returns public.user_role_assignments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_role public.app_role;
  v_result public.user_role_assignments;
begin
  if private.current_role() is distinct from 'pv_admin' then
    raise exception 'Rol atama yetkisi yalnızca pv_admin''e aittir';
  end if;

  if p_role in ('partner_admin', 'partner_employee') then
    if not exists (select 1 from public.profiles where id = p_user_id and partner_id is not null) then
      raise exception 'partner_admin/partner_employee rolü için kullanıcının profiles.partner_id değeri atanmış olmalı';
    end if;
  end if;

  select role into v_old_role from public.user_role_assignments where user_id = p_user_id;

  insert into public.user_role_assignments (user_id, role, assigned_by)
  values (p_user_id, p_role, auth.uid())
  on conflict (user_id) do update
    set role = excluded.role,
        assigned_by = excluded.assigned_by,
        assigned_at = now()
  returning * into v_result;

  perform private.write_audit_log(
    'set_role', 'user_role_assignments', p_user_id,
    jsonb_build_object('role', v_old_role),
    jsonb_build_object('role', p_role),
    null
  );

  return v_result;
end;
$$;

create or replace function public.set_user_active(
  p_user_id uuid,
  p_is_active boolean
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old boolean;
  v_result public.profiles;
begin
  if private.current_role() is distinct from 'pv_admin' then
    raise exception 'Aktif/pasif yapma yetkisi yalnızca pv_admin''e aittir';
  end if;

  select is_active into v_old from public.profiles where id = p_user_id;
  if v_old is null then
    raise exception 'Kullanıcı bulunamadı';
  end if;

  update public.profiles
  set is_active = p_is_active
  where id = p_user_id
  returning * into v_result;

  perform private.write_audit_log(
    'set_active', 'profiles', p_user_id,
    jsonb_build_object('is_active', v_old),
    jsonb_build_object('is_active', p_is_active),
    null
  );

  return v_result;
end;
$$;

create or replace function public.assign_lead_to_sales(
  p_lead_id uuid,
  p_sales_user_id uuid
)
returns public.leads
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_role public.app_role := private.current_role();
  v_lead public.leads;
  v_target_role public.app_role;
  v_target_active boolean;
begin
  select * into v_lead from public.leads where id = p_lead_id and deleted_at is null;
  if v_lead is null then
    raise exception 'Lead bulunamadı';
  end if;

  if not coalesce(
    v_caller_role = 'pv_admin'
    or (v_caller_role = 'first_call' and (v_lead.created_by = auth.uid() or v_lead.first_call_user_id = auth.uid())),
    false
  ) then
    raise exception 'Bu lead''i satış çalışanına atama yetkiniz yok';
  end if;

  select ura.role, p.is_active into v_target_role, v_target_active
  from public.profiles p
  join public.user_role_assignments ura on ura.user_id = p.id
  where p.id = p_sales_user_id;

  if v_target_role is distinct from 'pv_sales' or coalesce(v_target_active, false) = false then
    raise exception 'Hedef kullanıcı aktif bir satış çalışanı değil';
  end if;

  perform set_config('app.bypass_lead_protection', 'on', true);

  update public.leads
  set sales_user_id = p_sales_user_id,
      owner_id = p_sales_user_id
  where id = p_lead_id
  returning * into v_lead;

  perform private.write_audit_log(
    'assign_sales', 'leads', p_lead_id,
    jsonb_build_object('sales_user_id', v_lead.sales_user_id),
    jsonb_build_object('sales_user_id', p_sales_user_id),
    null
  );

  return v_lead;
end;
$$;

create or replace function public.assign_lead_to_partner(
  p_lead_id uuid,
  p_partner_id uuid,
  p_employee_id uuid default null,
  p_response_due_at timestamptz default null,
  p_share_note text default null
)
returns public.partner_referrals
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_role public.app_role := private.current_role();
  v_lead public.leads;
  v_partner_status text;
  v_referral public.partner_referrals;
  v_due timestamptz := coalesce(p_response_due_at, now() + interval '2 days');
begin
  select * into v_lead from public.leads where id = p_lead_id and deleted_at is null;
  if v_lead is null then
    raise exception 'Lead bulunamadı';
  end if;

  if not coalesce(
    v_caller_role = 'pv_admin'
    or (v_caller_role = 'pv_sales' and (v_lead.owner_id = auth.uid() or v_lead.sales_user_id = auth.uid())),
    false
  ) then
    raise exception 'Bu lead için partner ataması yapma yetkiniz yok';
  end if;

  select status into v_partner_status from public.partners where id = p_partner_id;
  if v_partner_status is distinct from 'active' then
    raise exception 'Hedef partner aktif değil';
  end if;

  if p_employee_id is not null then
    if not exists (
      select 1
      from public.profiles pr
      join public.user_role_assignments ura on ura.user_id = pr.id
      where pr.id = p_employee_id
        and pr.partner_id = p_partner_id
        and ura.role in ('partner_admin', 'partner_employee')
    ) then
      raise exception 'Atanan çalışan bu partnere ait değil';
    end if;
  end if;

  insert into public.partner_referrals (
    lead_id, partner_id, referred_by, assigned_employee_id,
    response_due_at, share_note
  )
  values (
    p_lead_id, p_partner_id, auth.uid(), p_employee_id,
    v_due, p_share_note
  )
  returning * into v_referral;

  perform private.write_audit_log(
    'assign_partner', 'leads', p_lead_id,
    null,
    jsonb_build_object('partner_id', p_partner_id, 'assigned_employee_id', p_employee_id),
    null
  );

  return v_referral;
end;
$$;

create or replace function public.respond_to_referral(
  p_referral_id uuid,
  p_decision text,
  p_rejection_reason text default null
)
returns public.partner_referrals
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_role public.app_role := private.current_role();
  v_referral public.partner_referrals;
  v_result public.partner_referrals;
begin
  if p_decision not in ('accept', 'reject') then
    raise exception 'Geçersiz karar: accept veya reject olmalı';
  end if;

  select * into v_referral from public.partner_referrals where id = p_referral_id;
  if v_referral is null then
    raise exception 'Yönlendirme bulunamadı';
  end if;

  if v_referral.status <> 'pending' then
    raise exception 'Bu yönlendirme zaten yanıtlanmış';
  end if;

  if not coalesce(
    (v_caller_role = 'partner_admin' and v_referral.partner_id = private.current_partner_id())
    or (
      v_caller_role = 'partner_employee'
      and v_referral.partner_id = private.current_partner_id()
      and v_referral.assigned_employee_id = auth.uid()
    ),
    false
  ) then
    raise exception 'Bu yönlendirmeyi yanıtlama yetkiniz yok';
  end if;

  if p_decision = 'reject' and (p_rejection_reason is null or trim(p_rejection_reason) = '') then
    raise exception 'Ret için bir gerekçe girilmelidir';
  end if;

  update public.partner_referrals
  set
    status = case when p_decision = 'accept' then 'accepted' else 'rejected' end,
    responded_at = now(),
    responded_by = auth.uid(),
    rejection_reason = case when p_decision = 'reject' then p_rejection_reason else null end,
    closed_at = case when p_decision = 'reject' then now() else null end
  where id = p_referral_id
  returning * into v_result;

  perform private.write_audit_log(
    case when p_decision = 'accept' then 'referral_accept' else 'referral_reject' end,
    'partner_referrals', p_referral_id,
    jsonb_build_object('status', v_referral.status),
    jsonb_build_object('status', v_result.status),
    p_rejection_reason
  );

  return v_result;
end;
$$;
