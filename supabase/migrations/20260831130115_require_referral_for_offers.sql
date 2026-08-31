-- İş modeli artık her satışın bir partner üzerinden yürümesini gerektiriyor:
-- teklif her türlü partnere gidecek. create_offer önceden aktif (kapanmamış)
-- bir referral bulamazsa sessizce referral_id=NULL yazıyordu ("doğrudan
-- satış" yolu) — artık bunun yerine hata veriyor, referral_id de NOT NULL.
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

  select id into v_referral_id
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

  return v_result;
end;
$function$;

alter table public.offers alter column referral_id set not null;
