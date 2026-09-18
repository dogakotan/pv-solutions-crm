-- Dokuzuncu tur inceleme, orta öncelik (2 madde, aynı fonksiyon):
--
-- 1) won->won düzeltmesinde eski seçim FARKLI bir offers satırına aitse
--    (lead lost->reactivate->yeniden referral döngüsünden geçmişse — bkz.
--    20260918140000), o eski offer_versions satırı 'superseded' olsa da
--    kendi offers satırı hep 'accepted' durumunda donmuş kalıyordu. Artık
--    eski offer, yeni seçimden farklıysa 'rejected'e dönüyor.
--
-- 2) Bir sales_outcomes satırı zaten varsa (düzeltme yolu), referral_id her
--    zaman ESKİ sonucun sakladığı referral_id'den alınıyordu — seçilen
--    teklifin GERÇEK referral'ı (offers.referral_id) yoksayılıyordu. Lead
--    birden fazla referral döngüsünden geçip düzeltme YENİ bir partnerin
--    teklifine işaret ederse, bildirim yanlışlıkla eski (kapanmış) partnere
--    gidiyordu. Artık won için önce seçilen teklifin kendi referral_id'si
--    kullanılıyor; yalnızca o offer'ın hiç referral'ı yoksa (partnersiz
--    doğrudan PV teklifi) eski davranışa (mevcut sonucun referral_id'si ya
--    da açık referral araması) düşülüyor.
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
  v_offer_version_status text;
  v_offer_referral_id uuid;
  v_new_offer_id uuid;
  v_existing_outcome public.sales_outcomes;
  v_has_existing_outcome boolean;
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

    select o.id, o.lead_id, o.referral_id, ov.status
      into v_new_offer_id, v_offer_lead_id, v_offer_referral_id, v_offer_version_status
    from public.offer_versions ov
    join public.offers o on o.id = ov.offer_id
    where ov.id = p_accepted_offer_version_id;

    if v_offer_lead_id is distinct from p_lead_id then
      raise exception 'Seçilen teklif revizyonu bu leade ait değil';
    end if;

    if v_offer_version_status = 'rejected' then
      raise exception 'Partner tarafından reddedilmiş bir teklif revizyonu kazanılan satış olarak kaydedilemez';
    end if;
  else
    if p_lost_reason is null or trim(p_lost_reason) = '' then
      raise exception 'Kaybedilen satış için bir gerekçe girilmelidir';
    end if;
  end if;

  select * into v_existing_outcome from public.sales_outcomes where lead_id = p_lead_id;
  v_has_existing_outcome := found;

  if p_outcome = 'won' and v_offer_referral_id is not null then
    v_referral_id := v_offer_referral_id;
    select partner_id, assigned_employee_id into v_referral_partner_id, v_referral_employee_id
    from public.partner_referrals
    where id = v_referral_id;
  elsif not v_has_existing_outcome then
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
    -- won->won düzeltmesi: seçilen revizyon değiştiyse, eski seçim artık
    -- "kabul edilmiş" değil — 'superseded'e dönüyor (iki revizyon aynı anda
    -- 'accepted' görünmesin diye).
    if v_existing_outcome.outcome = 'won'
      and v_existing_outcome.accepted_offer_version_id is not null
      and v_existing_outcome.accepted_offer_version_id is distinct from p_accepted_offer_version_id
    then
      update public.offer_versions set status = 'superseded' where id = v_existing_outcome.accepted_offer_version_id;

      -- Eski seçim FARKLI bir offers satırına aitse, o offer artık kazanan
      -- değil — 'rejected'e dönüyor (aynı offer içindeki bir başka revizyona
      -- geçişse offers.status zaten aşağıda 'accepted' kalacağından dokunma).
      update public.offers set status = 'rejected'
      where id = (select offer_id from public.offer_versions where id = v_existing_outcome.accepted_offer_version_id)
        and id is distinct from v_new_offer_id;
    end if;

    update public.offer_versions set status = 'accepted' where id = p_accepted_offer_version_id;
    update public.offers set status = 'accepted' where id = v_new_offer_id;

    if v_referral_id is not null then
      update public.partner_referrals
      set status = 'completed', closed_at = now()
      where id = v_referral_id;
    end if;
  else
    if v_existing_outcome.outcome = 'won' and v_existing_outcome.accepted_offer_version_id is not null then
      update public.offer_versions set status = 'rejected' where id = v_existing_outcome.accepted_offer_version_id;
      update public.offers set status = 'rejected'
      where id = (select offer_id from public.offer_versions where id = v_existing_outcome.accepted_offer_version_id);
    end if;

    if v_referral_id is not null then
      update public.partner_referrals
      set status = 'cancelled', closed_at = now()
      where id = v_referral_id;
    end if;
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
