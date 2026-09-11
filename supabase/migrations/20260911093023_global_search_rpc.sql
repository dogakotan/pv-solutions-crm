create or replace function public.global_search(p_query text)
returns table (
  entity_type text,
  entity_id uuid,
  primary_label text,
  secondary_label text,
  tertiary_label text
)
language sql
stable
as $$
  with q as (
    select '%' || replace(replace(trim(p_query), '%', '\%'), '_', '\_') || '%' as pattern
  )
  (
    select 'lead', l.id, l.customer_name, l.lead_no, l.phone
    from public.leads l, q
    where l.deleted_at is null
      and (l.customer_name ilike q.pattern escape '\'
        or l.lead_no ilike q.pattern escape '\'
        or l.phone ilike q.pattern escape '\')
    order by l.created_at desc
    limit 8
  )
  union all
  (
    select 'partner', p.id, p.name, p.partner_code, p.city
    from public.partners p, q
    where p.name ilike q.pattern escape '\' or p.partner_code ilike q.pattern escape '\'
    order by p.name
    limit 8
  )
  union all
  (
    select 'offer', o.id, l.customer_name, o.offer_no, o.status::text
    from public.offers o
    join public.leads l on l.id = o.lead_id, q
    where o.offer_no ilike q.pattern escape '\' or l.customer_name ilike q.pattern escape '\'
    order by o.created_at desc
    limit 8
  )
$$;

revoke all on function public.global_search(text) from public, anon;
grant execute on function public.global_search(text) to authenticated;
