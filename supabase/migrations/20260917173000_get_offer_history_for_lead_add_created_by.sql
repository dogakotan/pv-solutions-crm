-- Altıncı tur inceleme, açık madde: pv_sales, delete_offer_version RPC'sinin
-- gerçek kuralı (pv_admin OR created_by = auth.uid()) yalnızca pv_admin
-- VEYA revizyonu OLUŞTURAN sales'e izin vermesine rağmen, "Sil" butonunu
-- BAŞKASININ oluşturduğu revizyonlarda da görüyordu (canDelete/canManageOffers
-- salt appRole'e bakıyordu, revizyonun created_by'ına değil). Butona
-- tıklarsa RPC doğru şekilde reddediyordu (güvenlik açığı yok), ama bu
-- gösterimsel bir tutarsızlıktı. En son revizyonun created_by'ını da
-- döndürüp istemci tarafında bunu ayırt edebilmeyi sağlıyor.
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
        'created_by', ov.created_by,
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

revoke all on function public.get_offer_history_for_lead(uuid) from anon;
revoke execute on function public.get_offer_history_for_lead(uuid) from public;
