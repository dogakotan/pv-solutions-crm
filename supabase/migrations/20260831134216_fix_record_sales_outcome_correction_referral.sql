-- record_sales_outcome her çağrıda aktif (closed_at is null) referral'ı
-- yeniden arıyordu. İlk çağrıda referral'ı kendisi kapattığı için
-- (completed/cancelled), aynı lead için bir DÜZELTME çağrısında (örn.
-- won->lost) bu arama artık hiçbir şey bulamıyor, v_referral_id NULL
-- kalıyor: (1) sales_outcomes.referral_id NULL'a üzerine yazılıyor
-- (veri kaybı), (2) partner_referrals'ın durumu asla düzeltilmiyor
-- (örn. won->lost düzeltmesinde referral 'completed' olarak kalıyor).
-- Düzeltme: bu lead için zaten bir sales_outcomes satırı varsa, aktif
-- referral'ı yeniden aramak yerine o satırın referral_id'sini (hangi
-- durumdaki referral olursa olsun) yeniden kullan.
create or replace function public.record_sales_outcome(
  p_lead_id uuid,
  p_outcome text,
  p_accepted_offer_version_id uuid default null::uuid,
  p_final_amount numeric default null::numeric,
  p_currency text default null::text,
  p_lost_reason text default null::text,
  p_lost_reason_detail text default null::text,
  p_result_date date default CURRENT_DATE,
  p_notes text default null::text
)
returns sales_outcomes
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_caller_role public.app_role := private.current_role();
  v_lead public.leads;
  v_offer_lead_id uuid;
  v_existing_outcome public.sales_outcomes;
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

  select * into v_existing_outcome from public.sales_outcomes where lead_id = p_lead_id;

  if not found then
    select id, partner_id, assigned_employee_id into v_referral_id, v_referral_partner_id, v_referral_employee_id
    from public.partner_referrals
    where lead_id = p_lead_id and closed_at is null
    limit 1;
  else
    v_referral_id := v_existing_outcome.referral_id;
    if v_referral_id is not null then
      select partner_id, assigned_employee_id into v_referral_partner_id, v_referral_employee_id
      from public.partner_referrals
      where id = v_referral_id;
    end if;
  end if;

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
$function$;
