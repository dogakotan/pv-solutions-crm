-- =========================================================
-- Faz 8: satış sonucu kaydı. sales_outcomes tablosu Faz 0'da kurulmuştu
-- ama hiçbir RPC/UI bağlanmamıştı (migration'ın kendi yorumu:
-- "offers.status'ü otomatik 'accepted' yapan senkron trigger burada
-- YOK, sonraki iş-mantığı geçişinde eklenecek" — bu o geçiş).
--
-- record_sales_outcome tek çağrıda: sales_outcomes'a yazar/günceller
-- (upsert, lead_id unique), leads.stage'i won/lost yapar, won ise
-- ilgili offer_version + offer'ı 'accepted' işaretler, ve lead'in açık
-- (closed_at is null) bir partner_referrals kaydı varsa onu kapatır
-- (won → completed, lost → cancelled) — böylece partner performans
-- KPI'ları (getPartnerReferralKpis: completed/unsuccessful) otomatik
-- doğru sayar.
--
-- Yetki: yalnızca pv_admin veya lead'in owner_id'si (pv_sales) —
-- sales_outcomes_insert/update RLS policy'siyle birebir aynı kural.
-- Diğer tüm RPC'lerdeki NULL-propagation hatasından kaçınmak için
-- coalesce(..., false) kullanılıyor (bkz. fix_null_propagation_in_rpc_permission_checks).
-- =========================================================

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

  select id into v_referral_id
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

  return v_result;
end;
$$;

revoke execute on function public.record_sales_outcome(uuid, text, uuid, numeric, text, text, text, date, text) from public;
grant execute on function public.record_sales_outcome(uuid, text, uuid, numeric, text, text, text, date, text) to authenticated;
