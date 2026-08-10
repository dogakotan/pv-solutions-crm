-- =========================================================
-- Faz 9: olay bazlı bildirimler. notifications tablosuna authenticated
-- hiç INSERT yetkisi almıyor (bkz. notifications_core.sql yorumu) —
-- satırlar yalnızca burada güncellenen SECURITY DEFINER RPC'lerin
-- içinden, ilgili iş olayı gerçekleştiğinde oluşturuluyor.
--
-- 4 RPC güncellendi (mevcut yetki/iş mantığı AYNEN korunuyor, sona
-- bildirim insert'i eklendi):
--   assign_lead_to_sales   -> atanan satış çalışanına
--   assign_lead_to_partner -> atanan çalışana (varsa) yoksa partnerin
--                             tüm partner_admin'lerine
--   respond_to_referral    -> yönlendirmeyi yapan kişiye (referred_by)
--   record_sales_outcome   -> (varsa) ilişkili referral'ın partner
--                             tarafına (çalışan veya partner_admin'ler)
-- =========================================================

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

  insert into public.notifications (recipient_user_id, type, title, message, entity_type, entity_id, priority)
  values (
    p_sales_user_id, 'lead_assigned', 'Yeni lead atandı',
    v_lead.lead_no || ' — ' || v_lead.customer_name,
    'lead', p_lead_id, 'normal'
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

  if p_employee_id is not null then
    insert into public.notifications (recipient_user_id, type, title, message, entity_type, entity_id, priority)
    values (
      p_employee_id, 'referral_received', 'Yeni bir müşteri yönlendirildi',
      v_lead.lead_no || ' — ' || v_lead.customer_name,
      'referral', v_referral.id, 'normal'
    );
  else
    insert into public.notifications (recipient_user_id, type, title, message, entity_type, entity_id, priority)
    select ura.user_id, 'referral_received', 'Yeni bir müşteri yönlendirildi',
      v_lead.lead_no || ' — ' || v_lead.customer_name,
      'referral', v_referral.id, 'normal'
    from public.user_role_assignments ura
    join public.profiles pr on pr.id = ura.user_id
    where pr.partner_id = p_partner_id and ura.role = 'partner_admin';
  end if;

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
  v_lead public.leads;
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

  if v_referral.referred_by is not null then
    select * into v_lead from public.leads where id = v_referral.lead_id;

    insert into public.notifications (recipient_user_id, type, title, message, entity_type, entity_id, priority)
    values (
      v_referral.referred_by,
      case when p_decision = 'accept' then 'referral_accepted' else 'referral_rejected' end,
      case when p_decision = 'accept' then 'Yönlendirme kabul edildi' else 'Yönlendirme reddedildi' end,
      coalesce(v_lead.lead_no || ' — ' || v_lead.customer_name, 'Lead') ||
        case when p_decision = 'reject' then ' (' || p_rejection_reason || ')' else '' end,
      'referral', p_referral_id,
      case when p_decision = 'reject' then 'high' else 'normal' end
    );
  end if;

  return v_result;
end;
$$;

create or replace function public.record_sales_outcome(
  p_lead_id uuid,
  p_outcome text,
  p_accepted_offer_version_id uuid default null,
  p_final_amount numeric default null,
  p_currency text default null,
  p_lost_reason text default null,
  p_lost_reason_detail text default null,
  p_result_date date default current_date,
  p_notes text default null
)
returns public.sales_outcomes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_role public.app_role := private.current_role();
  v_lead public.leads;
  v_offer_lead_id uuid;
  v_referral_id uuid;
  v_referral_partner_id uuid;
  v_referral_employee_id uuid;
  v_result public.sales_outcomes;
begin
  if p_outcome not in ('won', 'lost') then
    raise exception 'Geçersiz sonuç: won veya lost olmalı';
  end if;

  select * into v_lead from public.leads where id = p_lead_id and deleted_at is null;
  if v_lead is null then
    raise exception 'Lead bulunamadı';
  end if;

  if not coalesce(
    v_caller_role = 'pv_admin'
    or (v_caller_role = 'pv_sales' and v_lead.owner_id = auth.uid()),
    false
  ) then
    raise exception 'Bu lead için satış sonucu kaydetme yetkiniz yok';
  end if;

  if p_outcome = 'won' then
    if p_accepted_offer_version_id is null or p_final_amount is null or p_currency is null then
      raise exception 'Kazanılan satış için teklif revizyonu, tutar ve para birimi zorunludur';
    end if;

    select o.lead_id into v_offer_lead_id
    from public.offer_versions ov
    join public.offers o on o.id = ov.offer_id
    where ov.id = p_accepted_offer_version_id;

    if v_offer_lead_id is distinct from p_lead_id then
      raise exception 'Seçilen teklif revizyonu bu leade ait değil';
    end if;
  else
    if p_lost_reason is null or trim(p_lost_reason) = '' then
      raise exception 'Kaybedilen satış için bir gerekçe girilmelidir';
    end if;
  end if;

  select id, partner_id, assigned_employee_id into v_referral_id, v_referral_partner_id, v_referral_employee_id
  from public.partner_referrals
  where lead_id = p_lead_id and closed_at is null
  limit 1;

  insert into public.sales_outcomes (
    lead_id, referral_id, outcome, accepted_offer_version_id,
    final_amount, currency, lost_reason, lost_reason_detail,
    result_date, notes, created_by, updated_by
  ) values (
    p_lead_id, v_referral_id, p_outcome,
    case when p_outcome = 'won' then p_accepted_offer_version_id else null end,
    case when p_outcome = 'won' then p_final_amount else null end,
    case when p_outcome = 'won' then p_currency else null end,
    case when p_outcome = 'lost' then p_lost_reason else null end,
    case when p_outcome = 'lost' then p_lost_reason_detail else null end,
    coalesce(p_result_date, current_date),
    p_notes, auth.uid(), auth.uid()
  )
  on conflict (lead_id) do update set
    referral_id = excluded.referral_id,
    outcome = excluded.outcome,
    accepted_offer_version_id = excluded.accepted_offer_version_id,
    final_amount = excluded.final_amount,
    currency = excluded.currency,
    lost_reason = excluded.lost_reason,
    lost_reason_detail = excluded.lost_reason_detail,
    result_date = excluded.result_date,
    notes = excluded.notes,
    updated_by = auth.uid(),
    updated_at = now()
  returning * into v_result;

  perform set_config('app.bypass_lead_protection', 'on', true);
  update public.leads set stage = p_outcome where id = p_lead_id;

  if p_outcome = 'won' then
    update public.offer_versions set status = 'accepted' where id = p_accepted_offer_version_id;
    update public.offers set status = 'accepted'
    where id = (select offer_id from public.offer_versions where id = p_accepted_offer_version_id);

    if v_referral_id is not null then
      update public.partner_referrals
      set status = 'completed', closed_at = now()
      where id = v_referral_id;
    end if;
  elsif v_referral_id is not null then
    update public.partner_referrals
    set status = 'cancelled', closed_at = now()
    where id = v_referral_id;
  end if;

  perform private.write_audit_log(
    'record_sales_outcome', 'leads', p_lead_id,
    jsonb_build_object('stage', v_lead.stage),
    jsonb_build_object('outcome', p_outcome),
    p_notes
  );

  if v_referral_id is not null then
    if v_referral_employee_id is not null then
      insert into public.notifications (recipient_user_id, type, title, message, entity_type, entity_id, priority)
      values (
        v_referral_employee_id,
        case when p_outcome = 'won' then 'sale_won' else 'sale_lost' end,
        case when p_outcome = 'won' then 'Yönlendirmeniz satışla sonuçlandı' else 'Yönlendirmeniz kayıpla sonuçlandı' end,
        v_lead.lead_no || ' — ' || v_lead.customer_name,
        'lead', p_lead_id, 'normal'
      );
    else
      insert into public.notifications (recipient_user_id, type, title, message, entity_type, entity_id, priority)
      select ura.user_id,
        case when p_outcome = 'won' then 'sale_won' else 'sale_lost' end,
        case when p_outcome = 'won' then 'Yönlendirmeniz satışla sonuçlandı' else 'Yönlendirmeniz kayıpla sonuçlandı' end,
        v_lead.lead_no || ' — ' || v_lead.customer_name,
        'lead', p_lead_id, 'normal'
      from public.user_role_assignments ura
      join public.profiles pr on pr.id = ura.user_id
      where pr.partner_id = v_referral_partner_id and ura.role = 'partner_admin';
    end if;
  end if;

  return v_result;
end;
$$;
