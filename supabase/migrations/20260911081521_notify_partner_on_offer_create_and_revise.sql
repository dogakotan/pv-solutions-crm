-- create_offer/revise_offer hiç bildirim göndermiyordu — teklifler artık
-- zorunlu olarak bir partner referral'ına bağlı olduğu için (bkz.
-- require_referral_for_offers) partner, kendi lead'i için bir teklif
-- oluşturulduğunu/revize edildiğini yalnızca sayfaya girip bakarak
-- öğreniyordu. record_sales_outcome'daki mevcut bildirim deseni
-- (assigned_employee_id varsa ona, yoksa tüm partner_admin'lere) aynen
-- uygulanıyor.
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

  insert into public.offers (offer_no, lead_id, referral_id, created_by_organization_type, created_by)
  values ('TEKLIF-' || v_lead.lead_no, p_lead_id, v_referral_id, 'pv', auth.uid())
  returning id into v_offer_id;

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
