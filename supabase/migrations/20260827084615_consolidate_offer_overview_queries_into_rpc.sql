-- getOffersOverview / getOffersForPartner: teklif listesi + her teklifin
-- en son revizyonunun tutarı iki ayrı sorguyla (offers, sonra
-- offer_versions) çekilip JS Map'inde en yüksek revision_no seçiliyordu.
-- Tek sorguya indirildi (lateral + order by revision_no desc limit 1).
-- getVisibleOffers/Excel export akışına DOKUNULMADI — kullanıcı onaylı
-- format ayrı tutuluyor (bkz. OfferListItem/offers-list-workbook.ts).
create or replace function public.get_offers_overview(p_limit integer default 500)
returns table (
  id uuid,
  offer_no text,
  status text,
  created_at timestamptz,
  lead_no text,
  customer_name text,
  amount numeric,
  currency text,
  next_action_at date
)
language sql
stable
set search_path = public
as $$
  select
    o.id, o.offer_no, o.status, o.created_at,
    l.lead_no, l.customer_name,
    latest.amount, latest.currency, latest.valid_until as next_action_at
  from public.offers o
  join public.leads l on l.id = o.lead_id
  left join lateral (
    select ov.amount, ov.currency, ov.valid_until
    from public.offer_versions ov
    where ov.offer_id = o.id
    order by ov.revision_no desc
    limit 1
  ) latest on true
  order by o.created_at desc
  limit p_limit;
$$;

create or replace function public.get_offers_for_partner(p_partner_id uuid)
returns table (
  id uuid,
  offer_no text,
  status text,
  created_at timestamptz,
  lead_no text,
  customer_name text,
  latest_amount numeric,
  latest_currency text
)
language sql
stable
set search_path = public
as $$
  select
    o.id, o.offer_no, o.status, o.created_at,
    l.lead_no, l.customer_name,
    latest.amount as latest_amount, latest.currency as latest_currency
  from public.offers o
  join public.leads l on l.id = o.lead_id
  join public.partner_referrals pr on pr.id = o.referral_id and pr.partner_id = p_partner_id
  left join lateral (
    select ov.amount, ov.currency
    from public.offer_versions ov
    where ov.offer_id = o.id
    order by ov.revision_no desc
    limit 1
  ) latest on true
  order by o.created_at desc;
$$;

-- getOfferHistoryForLead: önce lead'in ilk teklifinin id'sini bulup
-- sonra ayrı bir sorguyla (getOfferVersions) revizyon+kalem listesini
-- çeken iki round trip'ti. Tek RPC'ye indirildi — revizyonlar ve
-- kalemler jsonb olarak nested dönüyor, TS tarafında aynı şekle
-- map ediliyor. getOfferVersions'ın kendisi (başka yerlerde de
-- kullanılan, tek round trip'lik fonksiyon) DEĞİŞTİRİLMEDİ.
create or replace function public.get_offer_history_for_lead(p_lead_id uuid)
returns table (
  offer_id uuid,
  versions jsonb
)
language sql
stable
set search_path = public
as $$
  with target_offer as (
    select o.id
    from public.offers o
    where o.lead_id = p_lead_id
    order by o.created_at asc
    limit 1
  )
  select
    t.id as offer_id,
    coalesce(v.versions, '[]'::jsonb) as versions
  from target_offer t
  left join lateral (
    select jsonb_agg(
      jsonb_build_object(
        'id', ov.id,
        'revision_no', ov.revision_no,
        'amount', ov.amount,
        'currency', ov.currency,
        'vat_included', ov.vat_included,
        'valid_until', ov.valid_until,
        'scope_summary', ov.scope_summary,
        'payment_method', ov.payment_method,
        'shipping_terms', ov.shipping_terms,
        'status', ov.status,
        'created_at', ov.created_at,
        'items', coalesce(items.arr, '[]'::jsonb)
      ) order by ov.revision_no desc
    ) as versions
    from public.offer_versions ov
    left join lateral (
      select jsonb_agg(
        jsonb_build_object(
          'id', ovi.id,
          'product_code', ovi.product_code,
          'product_name', ovi.product_name,
          'quantity', ovi.quantity,
          'unit_price', ovi.unit_price
        ) order by ovi.sort_order
      ) as arr
      from public.offer_version_items ovi
      where ovi.offer_version_id = ov.id
    ) items on true
    where ov.offer_id = t.id
  ) v on true;
$$;

revoke all on function public.get_offers_overview(integer) from anon;
revoke all on function public.get_offers_for_partner(uuid) from anon;
revoke all on function public.get_offer_history_for_lead(uuid) from anon;
