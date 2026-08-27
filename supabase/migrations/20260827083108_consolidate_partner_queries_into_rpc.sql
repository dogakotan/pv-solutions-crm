-- getPartners (5 round trip) / getPartnerById (4 round trip) tek RPC'ye
-- indirildi: partner satırı + service_regions/capabilities (array_agg) +
-- referral/sales istatistikleri (lateral join) tek sorguda. SECURITY
-- DEFINER değil — invoker olarak partners/partner_referrals/
-- sales_outcomes/profiles RLS'i çağıranın rolüyle otomatik uygulanıyor,
-- orijinal ayrı .from() sorgularıyla aynı görünürlük garantisi korunuyor.
--
-- application_areas/capabilities ayrımı public.APPLICATION_AREAS TS
-- sabitiyle (src/types/partner.ts) senkron tutulmalı — burada sabit
-- listeye gömüldü, TS tarafı değişirse burası da güncellenmeli.
create or replace function public.get_partners_with_stats(p_id uuid default null)
returns table (
  id uuid,
  partner_code text,
  name text,
  tax_number text,
  tax_office text,
  phone text,
  email text,
  city text,
  address text,
  status text,
  rating numeric,
  created_at timestamptz,
  pv_owner_name text,
  service_regions text[],
  capabilities text[],
  application_areas text[],
  total_leads bigint,
  active_leads bigint,
  sales bigint,
  conversion_rate numeric
)
language sql
stable
set search_path = public
as $$
  select
    p.id, p.partner_code, p.name, p.tax_number, p.tax_office, p.phone, p.email,
    p.city, p.address, p.status, p.rating, p.created_at,
    coalesce(owner.full_name, '—') as pv_owner_name,
    coalesce(regions.codes, array[]::text[]) as service_regions,
    coalesce(caps.capability_codes, array[]::text[]) as capabilities,
    coalesce(caps.application_area_codes, array[]::text[]) as application_areas,
    coalesce(stats.total_leads, 0) as total_leads,
    coalesce(stats.active_leads, 0) as active_leads,
    coalesce(stats.sales, 0) as sales,
    case when coalesce(stats.total_leads, 0) > 0
      then (coalesce(stats.sales, 0)::numeric / stats.total_leads) * 100
      else 0
    end as conversion_rate
  from public.partners p
  left join public.profiles owner on owner.id = p.pv_owner_id
  left join lateral (
    select array_agg(psr.region_code order by psr.region_code) as codes
    from public.partner_service_regions psr
    where psr.partner_id = p.id
  ) regions on true
  left join lateral (
    select
      array_agg(pc.capability_code order by pc.capability_code) filter (
        where pc.capability_code <> all (array['Tarımsal Sulama','Off Grid','Hibrit','Depolamalı'])
      ) as capability_codes,
      array_agg(pc.capability_code order by pc.capability_code) filter (
        where pc.capability_code = any (array['Tarımsal Sulama','Off Grid','Hibrit','Depolamalı'])
      ) as application_area_codes
    from public.partner_capabilities pc
    where pc.partner_id = p.id
  ) caps on true
  left join lateral (
    select
      count(*) as total_leads,
      count(*) filter (where pr.status in ('pending','accepted')) as active_leads,
      count(*) filter (where so.outcome = 'won') as sales
    from public.partner_referrals pr
    left join public.sales_outcomes so on so.referral_id = pr.id and so.outcome = 'won'
    where pr.partner_id = p.id
  ) stats on true
  where (p_id is null or p.id = p_id)
  order by p.created_at desc;
$$;

-- getRecommendedPartnersForLead: bölge/şehir eşleşen adayları bulan 2
-- sorgu + adayları çeken 1 sorgu + region listesi için 1 sorgu = 4 round
-- trip → tek sorgu. ilike (wildcard'sız) ile case-insensitive TAM eşleşme
-- semantiği korundu (orijinal `region_code.ilike.${term}` de wildcard
-- kullanmıyordu).
create or replace function public.get_recommended_partners_for_lead(p_city text, p_district text default null)
returns table (
  id uuid,
  name text,
  city text,
  service_regions text[],
  rating numeric
)
language sql
stable
set search_path = public
as $$
  with candidates as (
    select distinct p.id
    from public.partners p
    where p.status = 'active'
      and (
        p.city ilike p_city
        or exists (
          select 1 from public.partner_service_regions psr
          where psr.partner_id = p.id
            and (psr.region_code ilike p_city or (p_district is not null and psr.region_code ilike p_district))
        )
      )
  )
  select
    p.id, p.name, coalesce(p.city, '') as city,
    coalesce(regions.codes, array[]::text[]) as service_regions,
    coalesce(p.rating, 0) as rating
  from public.partners p
  join candidates c on c.id = p.id
  left join lateral (
    select array_agg(psr.region_code order by psr.region_code) as codes
    from public.partner_service_regions psr
    where psr.partner_id = p.id
  ) regions on true
  order by coalesce(p.rating, 0) desc
  limit 3;
$$;

revoke all on function public.get_partners_with_stats(uuid) from anon;
revoke all on function public.get_recommended_partners_for_lead(text, text) from anon;
