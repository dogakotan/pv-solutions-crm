-- Altıncı tur inceleme, açık madde: respond_to_offer'ın kabul yolu
-- kasıtlı olarak offers.status'a dokunmuyor (nihai karar hâlâ
-- record_sales_outcome'ın işi) ama "Aksiyon Gerektiren Teklifler"
-- listesi salt offers.status === 'open' filtresiyle kuruluyordu —
-- partner kabul ettikten, pv_sales sonucu kaydedene kadar geçen sürede
-- teklif, yapılacak bir şey kalmamasına rağmen "aksiyon bekliyor"
-- görünmeye devam ediyordu. En son revizyonun durumunu da döndürüp
-- istemci tarafında bu durumu ayırt edebilmeyi sağlıyor.
drop function public.get_offers_overview(integer);

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
  next_action_at date,
  latest_version_status text
)
language sql
stable
set search_path = public
as $$
  select
    o.id, o.offer_no, o.status, o.created_at,
    l.lead_no, l.customer_name,
    latest.amount, latest.currency, latest.valid_until as next_action_at,
    latest.status as latest_version_status
  from public.offers o
  join public.leads l on l.id = o.lead_id
  left join lateral (
    select ov.amount, ov.currency, ov.valid_until, ov.status
    from public.offer_versions ov
    where ov.offer_id = o.id
    order by ov.revision_no desc
    limit 1
  ) latest on true
  order by o.created_at desc
  limit p_limit;
$$;

revoke all on function public.get_offers_overview(integer) from anon;
revoke execute on function public.get_offers_overview(integer) from public;
