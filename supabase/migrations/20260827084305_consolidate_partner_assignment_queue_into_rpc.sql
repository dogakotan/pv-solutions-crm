-- getLeadsNeedingPartnerAssignment (assignments.ts) 2 round trip'ti:
-- adayları çek (limit N) → aktif yönlendirmesi olanları JS'te ele.
-- Bu, limit'i filtreden ÖNCE uyguluyordu — N adaydan bazıları elense
-- bile sonuç N'den az dönebiliyordu. Tek RPC'ye taşırken doğal SQL
-- semantiği (WHERE + NOT EXISTS önce, LIMIT sonra) kullanıldı; bu,
-- eski davranıştaki bu küçük eksik-doldurma pürüzünü de düzeltiyor.
create or replace function public.get_leads_needing_partner_assignment(p_limit integer default 50)
returns table (
  id uuid,
  lead_no text,
  customer_name text,
  city text,
  stage text,
  lead_score text
)
language sql
stable
set search_path = public
as $$
  select l.id, l.lead_no, l.customer_name, l.city, l.stage, l.lead_score
  from public.leads l
  where l.sales_user_id is not null
    and l.deleted_at is null
    and not exists (
      select 1 from public.partner_referrals pr
      where pr.lead_id = l.id and pr.closed_at is null
    )
  order by l.created_at asc
  limit p_limit;
$$;

revoke all on function public.get_leads_needing_partner_assignment(integer) from anon;
