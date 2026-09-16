-- Üçüncü tur inceleme, madde 1: respond_to_offer'ın reddi offers.status'a
-- yazmasından sonra (bkz. fix_offer_reject_status_and_won_guard) reddedilmiş
-- bir teklif revize edilip yeniden gönderildiğinde offers.status hâlâ
-- 'rejected'de kalıyordu — offers-list-filters/offers-overview-tabs yeni bir
-- karar bekleyen teklifi hâlâ "Reddedildi" gösteriyordu. offers guard trigger'ı
-- (enforce_offers_status_transition) old.status <> 'open' -> new.status =
-- 'open' geçişini TAMAMEN engelliyordu — bu artık çok katı: 'accepted'/
-- 'closed' gerçekten kesinleşmiş durumlar ama 'rejected' revize edilip
-- yeniden müzakereye açılabiliyor. Trigger yalnızca 'accepted'/'closed'
-- kaynaklı reversion'ı engelleyecek şekilde daraltıldı, revise_offer de
-- yalnızca mevcut durum 'rejected' ise 'open'a geri döndürüyor (accepted/
-- closed bir offer'ı sessizce yeniden açmıyor).
create or replace function private.enforce_offers_status_transition()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if old.status in ('accepted', 'closed') and new.status = 'open' then
    raise exception 'Geçersiz teklif durum geçişi: % -> % (kesinleşmiş bir teklif başlangıç durumuna döndürülemez)', old.status, new.status;
  end if;
  return new;
end;
$$;

create or replace function public.revise_offer(
  p_offer_id uuid,
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
  v_offer public.offers;
  v_lead public.leads;
  v_referral_partner_id uuid;
  v_referral_employee_id uuid;
  v_latest public.offer_versions;
  v_next_revision int;
  v_result public.offer_versions;
begin
  select * into v_offer from public.offers where id = p_offer_id;
  if v_offer is null then
    raise exception 'Teklif bulunamadı';
  end if;

  select * into v_lead from public.leads where id = v_offer.lead_id;

  if not coalesce(
    v_caller_role = 'pv_admin' or (v_caller_role = 'pv_sales' and v_lead.owner_id = auth.uid()),
    false
  ) then
    raise exception 'Bu teklifi revize etme yetkiniz yok';
  end if;

  select * into v_latest
  from public.offer_versions
  where offer_id = p_offer_id
  order by revision_no desc
  limit 1
  for update;

  v_next_revision := coalesce(v_latest.revision_no, -1) + 1;

  if v_latest.id is not null then
    update public.offer_versions set status = 'superseded' where id = v_latest.id;
  end if;

  insert into public.offer_versions (
    offer_id, revision_no, amount, currency, vat_included, valid_until,
    scope_summary, payment_method, shipping_terms, status, sent_at, created_by
  ) values (
    p_offer_id, v_next_revision, p_amount, p_currency, p_vat_included, p_valid_until,
    p_scope_summary, p_payment_method, p_shipping_terms, 'sent', now(), auth.uid()
  )
  returning * into v_result;

  insert into public.offer_version_items (offer_version_id, product_code, product_name, quantity, unit_price, sort_order)
  select v_result.id, x.product_code, x.product_name, x.quantity, x.unit_price, x.sort_order
  from jsonb_to_recordset(p_items) as x(product_code text, product_name text, quantity numeric, unit_price numeric, sort_order int);

  -- Reddedilmiş bir teklif yeniden gönderiliyor demek yeniden müzakereye
  -- açıldı demek — yalnızca 'rejected' ise 'open'a döner, 'accepted'/'closed'
  -- (kesinleşmiş durumlar) hiç dokunulmadan kalır.
  update public.offers set status = 'open' where id = p_offer_id and status = 'rejected';

  perform private.write_audit_log(
    'revise_offer', 'offer_versions', v_result.id,
    case when v_latest.id is not null then jsonb_build_object('revision_no', v_latest.revision_no) else null end,
    jsonb_build_object('revision_no', v_next_revision, 'amount', p_amount),
    null
  );

  select partner_id, assigned_employee_id into v_referral_partner_id, v_referral_employee_id
  from public.partner_referrals
  where id = v_offer.referral_id;

  if v_referral_employee_id is not null then
    insert into public.notifications (recipient_user_id, type, title, message, entity_type, entity_id, priority)
    values (
      v_referral_employee_id, 'offer_revised', 'Teklif revize edildi',
      v_lead.lead_no || ' — ' || v_lead.customer_name,
      'offer', v_offer.id, 'normal'
    );
  else
    insert into public.notifications (recipient_user_id, type, title, message, entity_type, entity_id, priority)
    select ura.user_id, 'offer_revised', 'Teklif revize edildi',
      v_lead.lead_no || ' — ' || v_lead.customer_name,
      'offer', v_offer.id, 'normal'
    from public.user_role_assignments ura
    join public.profiles pr on pr.id = ura.user_id
    where pr.partner_id = v_referral_partner_id and ura.role = 'partner_admin';
  end if;

  return v_result;
end;
$function$;

-- Üçüncü tur inceleme, madde 2: respond_to_offer check-then-act yapıyordu
-- (select ile status='sent' kontrolü, sonra ayrı bir update) — satır kilidi
-- olmadan iki eşzamanlı çağrı (ör. "Kabul Et"e çift tıklama) ikisi de
-- kontrolü geçip ikisi de audit_log/notification yazabiliyordu. update artık
-- WHERE status='sent' ile atomik: ikinci çağrı sıfır satır günceller ve
-- açık bir hatayla durur.
create or replace function public.respond_to_offer(
  p_offer_version_id uuid,
  p_decision text
)
returns public.offer_versions
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_caller_role public.app_role := private.current_role();
  v_version public.offer_versions;
  v_offer public.offers;
  v_lead public.leads;
  v_result public.offer_versions;
begin
  if p_decision not in ('accept', 'reject') then
    raise exception 'Geçersiz karar: accept veya reject olmalı';
  end if;

  select * into v_version from public.offer_versions where id = p_offer_version_id;
  if v_version is null then
    raise exception 'Teklif revizyonu bulunamadı';
  end if;

  select * into v_offer from public.offers where id = v_version.offer_id;

  if not coalesce(
    v_caller_role = 'partner_admin'
    and exists (
      select 1 from public.partner_referrals pr
      where pr.id = v_offer.referral_id and pr.partner_id = private.current_partner_id()
    ),
    false
  ) then
    raise exception 'Bu teklifi yanıtlama yetkiniz yok';
  end if;

  if v_version.status <> 'sent' then
    raise exception 'Yalnızca gönderilmiş bir revizyon yanıtlanabilir';
  end if;

  update public.offer_versions
  set status = case when p_decision = 'accept' then 'accepted' else 'rejected' end
  where id = p_offer_version_id and status = 'sent'
  returning * into v_result;

  if v_result is null then
    raise exception 'Yalnızca gönderilmiş bir revizyon yanıtlanabilir';
  end if;

  if p_decision = 'reject' then
    update public.offers set status = 'rejected' where id = v_offer.id;
  end if;

  perform private.write_audit_log(
    case when p_decision = 'accept' then 'offer_accept' else 'offer_reject' end,
    'offer_versions', p_offer_version_id,
    jsonb_build_object('status', v_version.status),
    jsonb_build_object('status', v_result.status),
    null
  );

  select * into v_lead from public.leads where id = v_offer.lead_id;

  if v_version.created_by is not null then
    insert into public.notifications (recipient_user_id, type, title, message, entity_type, entity_id, priority)
    values (
      v_version.created_by,
      case when p_decision = 'accept' then 'offer_accepted' else 'offer_rejected' end,
      case when p_decision = 'accept' then 'Teklif kabul edildi' else 'Teklif reddedildi' end,
      coalesce(v_lead.lead_no || ' — ' || v_lead.customer_name, 'Lead') || ' — Rev.' || v_version.revision_no,
      'offer', v_offer.id,
      case when p_decision = 'reject' then 'high' else 'normal' end
    );
  end if;

  return v_result;
end;
$$;
