-- Dördüncü tur, kullanıcı onaylı iki düzeltme:
--
-- 1) create_offer, offer_no'yu yalnızca lead_no'dan türetiyordu
--    ('TEKLIF-' || lead_no) — aynı lead için ikinci bir teklif (ilki
--    reddedildikten/kapandıktan sonra tamamen yeni bir teklif başlatmak)
--    unique constraint ihlaliyle çöküyordu. Artık çakışma anında bir
--    sonraki serbest sufiksi (TEKLIF-L-001-1, -2, ...) deneyen bir
--    döngü var.
create or replace function public.create_offer(
  p_lead_id uuid,
  p_amount numeric,
  p_currency text,
  p_vat_included boolean,
  p_valid_until date default null::date,
  p_scope_summary text default null::text,
  p_payment_method text default null::text,
  p_shipping_terms text default null::text,
  p_items jsonb default '[]'::jsonb
)
returns offer_versions
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_caller_role public.app_role := private.current_role();
  v_lead public.leads;
  v_referral_id uuid;
  v_referral_partner_id uuid;
  v_referral_employee_id uuid;
  v_offer_id uuid;
  v_offer_no text;
  v_suffix int := 0;
  v_result public.offer_versions;
begin
  select * into v_lead from public.leads where id = p_lead_id and deleted_at is null;
  if v_lead is null then
    raise exception 'Lead bulunamadı';
  end if;

  if not coalesce(
    v_caller_role = 'pv_admin' or (v_caller_role = 'pv_sales' and v_lead.owner_id = auth.uid()),
    false
  ) then
    raise exception 'Bu lead için teklif oluşturma yetkiniz yok';
  end if;

  select id, partner_id, assigned_employee_id into v_referral_id, v_referral_partner_id, v_referral_employee_id
  from public.partner_referrals
  where lead_id = p_lead_id and closed_at is null
  limit 1;

  if v_referral_id is null then
    raise exception 'Teklif oluşturmak için önce lead bir partnere atanmalı';
  end if;

  loop
    v_offer_no := 'TEKLIF-' || v_lead.lead_no || case when v_suffix = 0 then '' else '-' || v_suffix end;
    begin
      insert into public.offers (offer_no, lead_id, referral_id, created_by_organization_type, created_by)
      values (v_offer_no, p_lead_id, v_referral_id, 'pv', auth.uid())
      returning id into v_offer_id;
      exit;
    exception when unique_violation then
      v_suffix := v_suffix + 1;
      if v_suffix > 20 then
        raise;
      end if;
    end;
  end loop;

  insert into public.offer_versions (
    offer_id, revision_no, amount, currency, vat_included, valid_until,
    scope_summary, payment_method, shipping_terms, status, sent_at, created_by
  ) values (
    v_offer_id, 0, p_amount, p_currency, p_vat_included, p_valid_until,
    p_scope_summary, p_payment_method, p_shipping_terms, 'sent', now(), auth.uid()
  )
  returning * into v_result;

  insert into public.offer_version_items (offer_version_id, product_code, product_name, quantity, unit_price, sort_order)
  select v_result.id, x.product_code, x.product_name, x.quantity, x.unit_price, x.sort_order
  from jsonb_to_recordset(p_items) as x(product_code text, product_name text, quantity numeric, unit_price numeric, sort_order int);

  perform private.write_audit_log(
    'create_offer', 'offers', v_offer_id,
    null,
    jsonb_build_object('amount', p_amount, 'currency', p_currency),
    null
  );

  if v_referral_employee_id is not null then
    insert into public.notifications (recipient_user_id, type, title, message, entity_type, entity_id, priority)
    values (
      v_referral_employee_id, 'offer_created', 'Yeni bir teklif oluşturuldu',
      v_lead.lead_no || ' — ' || v_lead.customer_name,
      'offer', v_offer_id, 'normal'
    );
  else
    insert into public.notifications (recipient_user_id, type, title, message, entity_type, entity_id, priority)
    select ura.user_id, 'offer_created', 'Yeni bir teklif oluşturuldu',
      v_lead.lead_no || ' — ' || v_lead.customer_name,
      'offer', v_offer_id, 'normal'
    from public.user_role_assignments ura
    join public.profiles pr on pr.id = ura.user_id
    where pr.partner_id = v_referral_partner_id and ura.role = 'partner_admin';
  end if;

  return v_result;
end;
$function$;

-- 2) record_sales_outcome'ın "düzeltme" yolu (won -> lost) offer_versions/
--    offers'ı 'accepted', partner_referrals'ı 'completed' bırakıyordu —
--    1. turun kendi orijinal bulgusunun (2.2) yalnızca referral_id kaybı
--    kısmı düzeltilmişti, durum geri alma hiç yapılmamıştı. Artık bir
--    won->lost düzeltmesinde önceki kabul edilmiş revizyon/teklif
--    'rejected'e dönüyor (referral zaten aşağıdaki mevcut kodla
--    'cancelled'a dönüyordu).
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

    select o.lead_id, ov.status into v_offer_lead_id, v_offer_version_status
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
