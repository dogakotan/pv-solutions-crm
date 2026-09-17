-- Beşinci tur, önceden bilinçli atlanmış madde: get_recommended_partners_for_lead
-- yalnızca partners.rating'e (admin'in elle girdiği, hiçbir performans metriğiyle
-- bağı olmayan puan) göre sıralıyordu. src/lib/partner-rating.ts'deki
-- computeSuggestedPartnerRating (acceptance_rate %50, conversion %30, response
-- time %20 ağırlıklı) yalnızca reports sayfasında salt-görüntüleme amaçlı
-- kullanılıyordu, otomatik öneriye hiç yansımıyordu. Bu migration aynı formülü
-- SQL'e taşıyıp (get_partner_performance'daki acceptance/response/sales
-- hesaplarıyla birebir aynı) sıralamada ve gösterimde manuel puanın yerine
-- geçirir — hiç yönlendirme geçmişi olmayan (referral_count = 0) partnerler
-- için hesaplanamayacağından, o partnerler için manuel puana geri düşülür
-- (önceki davranışla aynı, yeni partnerleri sıfıra düşürmemek için).
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
  ),
  stats as (
    select
      pr.partner_id,
      count(*) as referral_count,
      count(*) filter (where pr.status <> 'pending') as responded_count,
      count(*) filter (where pr.status in ('accepted', 'completed')) as accepted_count,
      avg(extract(epoch from (pr.responded_at - pr.sent_at))) filter (where pr.responded_at is not null) as avg_response_seconds,
      count(distinct so.referral_id) as sales_count
    from public.partner_referrals pr
    join candidates c on c.id = pr.partner_id
    left join public.sales_outcomes so on so.referral_id = pr.id and so.outcome = 'won'
    group by pr.partner_id
  ),
  scored as (
    select
      c.id,
      case when coalesce(s.referral_count, 0) = 0 then null else
        round((
          (case when s.responded_count > 0 then (s.accepted_count::numeric / s.responded_count) else 0 end) * 5 * 0.5
          + least(s.sales_count::numeric / s.referral_count, 1) * 5 * 0.3
          + (case
              when s.avg_response_seconds is null then 2.5
              else greatest(0, 5 - ((s.avg_response_seconds / 3600.0) / 48.0) * 5)
            end) * 0.2
        ) * 10) / 10
      end as suggested_rating
    from candidates c
    left join stats s on s.partner_id = c.id
  )
  select
    p.id, p.name, coalesce(p.city, '') as city,
    coalesce(regions.codes, array[]::text[]) as service_regions,
    coalesce(sc.suggested_rating, coalesce(p.rating, 0)) as rating
  from public.partners p
  join candidates c on c.id = p.id
  join scored sc on sc.id = p.id
  left join lateral (
    select array_agg(psr.region_code order by psr.region_code) as codes
    from public.partner_service_regions psr
    where psr.partner_id = p.id
  ) regions on true
  order by coalesce(sc.suggested_rating, coalesce(p.rating, 0)) desc
  limit 3;
$$;

revoke all on function public.get_recommended_partners_for_lead(text, text) from anon;
revoke execute on function public.get_recommended_partners_for_lead(text, text) from public;
