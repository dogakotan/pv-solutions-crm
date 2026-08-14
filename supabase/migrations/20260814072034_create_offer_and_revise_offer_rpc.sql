-- Teklif oluşturma (offer + offer_versions[0] + kalemler) ve revize etme
-- (yeni revizyon + kalemler) artık tek SECURITY DEFINER RPC çağrısıyla
-- atomik yapılıyor. Önceki durumda leads/[id]/actions.ts bunu 3 ayrı
-- sıralı insert ile (transaction'sız) yapıyordu; ayrıca reviseOffer
-- "en son revizyonu oku, +1 yap" desenini JS'de uyguluyordu — eşzamanlı
-- iki revize isteği aynı revision_no'yu üretebilirdi. Burada `for update`
-- ile offer_versions satırı kilitlenerek bu yarış durumu kapatılıyor.
-- Yetki kontrolü offers_insert/offer_versions_update RLS policy'lerinin
-- bu app'in fiilen kullandığı alt kümesiyle (pv_admin veya lead'in
-- owner'ı olan pv_sales) birebir aynı.

create or replace function public.create_offer(
  p_lead_id uuid,
  p_amount numeric,
  p_currency text,
  p_vat_included boolean,
  p_valid_until date default null,
  p_scope_summary text default null,
  p_payment_method text default null,
  p_shipping_terms text default null,
  p_items jsonb default '[]'::jsonb
)
returns public.offer_versions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_role public.app_role := private.current_role();
  v_lead public.leads;
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

  insert into public.offers (offer_no, lead_id, created_by_organization_type, created_by)
  values ('TEKLIF-' || v_lead.lead_no, p_lead_id, 'pv', auth.uid())
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

  return v_result;
end;
$$;

revoke execute on function public.create_offer(uuid, numeric, text, boolean, date, text, text, text, jsonb) from public;
grant execute on function public.create_offer(uuid, numeric, text, boolean, date, text, text, text, jsonb) to authenticated;

create or replace function public.revise_offer(
  p_offer_id uuid,
  p_amount numeric,
  p_currency text,
  p_vat_included boolean,
  p_valid_until date default null,
  p_scope_summary text default null,
  p_payment_method text default null,
  p_shipping_terms text default null,
  p_items jsonb default '[]'::jsonb
)
returns public.offer_versions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_role public.app_role := private.current_role();
  v_offer public.offers;
  v_lead public.leads;
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

  if v_latest is not null then
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
    case when v_latest is not null then jsonb_build_object('revision_no', v_latest.revision_no) else null end,
    jsonb_build_object('revision_no', v_next_revision, 'amount', p_amount),
    null
  );

  return v_result;
end;
$$;

revoke execute on function public.revise_offer(uuid, numeric, text, boolean, date, text, text, text, jsonb) from public;
grant execute on function public.revise_offer(uuid, numeric, text, boolean, date, text, text, text, jsonb) to authenticated;
