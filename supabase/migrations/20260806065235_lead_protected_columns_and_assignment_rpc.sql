-- =========================================================
-- leads: ayrıcalıklı kolon koruması + güvenli atama/silme RPC'leri
-- Spec: "sales_user_id, first_call_user_id, created_by gibi alanlar
-- client update ile değiştirilip erişim kapsamı genişletilemez" —
-- bu yüzden UPDATE trigger ile korunuyor, atama işlemleri yalnızca
-- aşağıdaki SECURITY DEFINER RPC'ler üzerinden (bypass GUC ile) yapılabiliyor.
-- =========================================================

-- ---------------------------------------------------------
-- 1) Koruma trigger'ı
-- ---------------------------------------------------------
create or replace function private.protect_lead_privileged_columns()
returns trigger
language plpgsql
as $$
begin
  if private.current_role() = 'pv_admin' then
    return new;
  end if;

  if coalesce(current_setting('app.bypass_lead_protection', true), '') = 'on' then
    return new;
  end if;

  if new.owner_id is distinct from old.owner_id
     or new.first_call_user_id is distinct from old.first_call_user_id
     or new.sales_user_id is distinct from old.sales_user_id
     or new.created_by is distinct from old.created_by
     or new.deleted_at is distinct from old.deleted_at
     or new.deleted_by is distinct from old.deleted_by
  then
    raise exception 'Bu alanlar yalnızca yetkili sunucu işlemleri (assign/soft-delete RPC) veya pv_admin tarafından değiştirilebilir';
  end if;

  return new;
end;
$$;

revoke execute on function private.protect_lead_privileged_columns() from public;

create trigger protect_leads_privileged_columns
  before update on public.leads
  for each row
  execute function private.protect_lead_privileged_columns();

-- ---------------------------------------------------------
-- 2) Audit log yazma yardımcı fonksiyonu (yalnızca diğer
--    SECURITY DEFINER fonksiyonların içinden çağrılır)
-- ---------------------------------------------------------
create or replace function private.write_audit_log(
  p_action text,
  p_entity_type text,
  p_entity_id uuid,
  p_old_values jsonb,
  p_new_values jsonb,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, old_values, new_values, reason)
  values (auth.uid(), p_action, p_entity_type, p_entity_id, p_old_values, p_new_values, p_reason);
end;
$$;

revoke execute on function private.write_audit_log(text, text, uuid, jsonb, jsonb, text) from public;

-- ---------------------------------------------------------
-- 3) assign_lead_to_sales: pv_admin veya lead'in first_call sahibi
--    çağırabilir; hedefin aktif bir pv_sales olduğu doğrulanır.
-- ---------------------------------------------------------
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

  if not (
    v_caller_role = 'pv_admin'
    or (v_caller_role = 'first_call' and (v_lead.created_by = auth.uid() or v_lead.first_call_user_id = auth.uid()))
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

revoke execute on function public.assign_lead_to_sales(uuid, uuid) from public;
grant execute on function public.assign_lead_to_sales(uuid, uuid) to authenticated;

-- ---------------------------------------------------------
-- 4) assign_lead_to_partner: pv_admin veya lead'in sales sahibi
--    çağırabilir; hedef partnerin aktif olduğu, varsa çalışanın o
--    partnere ait olduğu doğrulanır. partner_referrals'a yazar.
-- ---------------------------------------------------------
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

  if not (
    v_caller_role = 'pv_admin'
    or (v_caller_role = 'pv_sales' and (v_lead.owner_id = auth.uid() or v_lead.sales_user_id = auth.uid()))
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
        and ura.role in ('partner_admin','partner_employee')
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

revoke execute on function public.assign_lead_to_partner(uuid, uuid, uuid, timestamptz, text) from public;
grant execute on function public.assign_lead_to_partner(uuid, uuid, uuid, timestamptz, text) to authenticated;

-- ---------------------------------------------------------
-- 5) soft_delete_lead: yalnızca pv_admin
-- ---------------------------------------------------------
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
  if private.current_role() <> 'pv_admin' then
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

revoke execute on function public.soft_delete_lead(uuid, text) from public;
grant execute on function public.soft_delete_lead(uuid, text) to authenticated;
