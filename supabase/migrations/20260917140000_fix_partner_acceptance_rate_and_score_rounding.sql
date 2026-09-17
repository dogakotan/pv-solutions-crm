-- Altıncı tur inceleme, açık madde: record_sales_outcome bir lead
-- KAYBEDİLDİ olarak kaydedildiğinde, o ana kadar KABUL EDİLMİŞ bir
-- referral'ı sessizce 'cancelled'a çeviriyor (partnerin gerçekten
-- kabul edip çalıştığı ama satışa çeviremediği bir referral). Hem
-- get_partner_performance hem get_recommended_partners_for_lead
-- "kabul oranı"nı status in ('accepted','completed') filtresiyle
-- hesapladığı için, bu referral kabul payından tamamen düşüyor —
-- gerçekten duyarlı (kabul eden) ama dönüşüm oranı düşük bir partner,
-- hem kabul payında hem zaten ayrı puanlanan dönüşüm payında iki kez
-- cezalandırılıyor. 'cancelled' yalnızca record_sales_outcome'dan
-- gelir (grep ile doğrulandı) ve yalnızca ya hiç yanıtlanmamış
-- (responded_at null, sales pes edip lead'i kaybedildi işaretlemiş)
-- ya da önceden kabul edilmiş (responded_at not null) bir referral'a
-- uygulanabilir — responded_at not null olması "gerçekten kabul
-- edilmişti" için yeterli ve doğru bir ayraç (reddedilen referral'lar
-- zaten kendi kabul anında closed_at set edip bu yola hiç girmiyor).
--
-- Ayrıca get_recommended_partners_for_lead ham (yuvarlanmamış) oranlar
-- kullanırken get_partner_performance aynı oranları önce tam sayıya
-- yuvarlıyordu (src/lib/partner-rating.ts'nin computeSuggestedPartnerRating'i
-- de rapor sayfasında bu YUVARLANMIŞ değerleri kullanıyor) — aynı
-- partnerin puanı öneri listesiyle raporlar sayfası arasında aynı anda
-- 0.1 farklı çıkabiliyordu. get_recommended_partners_for_lead artık
-- get_partner_performance ile birebir aynı ara yuvarlamayı uyguluyor.
-- Gerçek SQL rol-taklidiyle doğrulandı: kabul edilmiş bir referral
-- 'lost' sonucuyla 'cancelled'a çevrildiğinde acceptance_rate artık
-- doğru şekilde 100 kalıyor (önceden 0'a düşerdi).
create or replace function public.get_partner_performance(p_from text default null, p_to text default null, p_partner_id uuid default null)
returns table (
  partner_id uuid,
  partner_name text,
  rating numeric,
  referral_count bigint,
  acceptance_rate integer,
  avg_response_hours integer,
  offer_count bigint,
  sales_count bigint
)
language sql
stable
set search_path = public
as $$
  with scoped_referrals as (
    select pr.id, pr.partner_id, pr.status, pr.sent_at, pr.responded_at
    from public.partner_referrals pr
    where (p_from is null or pr.sent_at >= p_from::timestamptz)
      and (p_to is null or pr.sent_at < (p_to::date + 1)::timestamptz)
      and (p_partner_id is null or pr.partner_id = p_partner_id)
  ),
  by_partner as (
    select
      partner_id,
      count(*) as referral_count,
      count(*) filter (where status <> 'pending') as responded_count,
      count(*) filter (
        where status in ('accepted', 'completed')
           or (status = 'cancelled' and responded_at is not null)
      ) as accepted_count,
      avg(extract(epoch from (responded_at - sent_at))) filter (where responded_at is not null) as avg_response_seconds
    from scoped_referrals
    group by partner_id
  ),
  offers_by_partner as (
    select sr.partner_id, count(*) as offer_count
    from public.offers o
    join scoped_referrals sr on sr.id = o.referral_id
    group by sr.partner_id
  ),
  sales_by_partner as (
    select sr.partner_id, count(distinct so.referral_id) as sales_count
    from public.sales_outcomes so
    join scoped_referrals sr on sr.id = so.referral_id
    where so.outcome = 'won'
    group by sr.partner_id
  )
  select
    bp.partner_id,
    coalesce(p.name, '—') as partner_name,
    p.rating,
    bp.referral_count,
    case when bp.responded_count > 0
      then round((bp.accepted_count::numeric / bp.responded_count) * 100)::integer
      else 0
    end as acceptance_rate,
    case when bp.avg_response_seconds is not null
      then round(bp.avg_response_seconds / 3600)::integer
      else null
    end as avg_response_hours,
    coalesce(ob.offer_count, 0) as offer_count,
    coalesce(sb.sales_count, 0) as sales_count
  from by_partner bp
  join public.partners p on p.id = bp.partner_id
  left join offers_by_partner ob on ob.partner_id = bp.partner_id
  left join sales_by_partner sb on sb.partner_id = bp.partner_id;
$$;

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
      count(*) filter (
        where pr.status in ('accepted', 'completed')
           or (pr.status = 'cancelled' and pr.responded_at is not null)
      ) as accepted_count,
      avg(extract(epoch from (pr.responded_at - pr.sent_at))) filter (where pr.responded_at is not null) as avg_response_seconds,
      count(distinct so.referral_id) as sales_count
    from public.partner_referrals pr
    join candidates c on c.id = pr.partner_id
    left join public.sales_outcomes so on so.referral_id = pr.id and so.outcome = 'won'
    group by pr.partner_id
  ),
  rounded as (
    select
      c.id,
      s.referral_count,
      s.sales_count,
      case when coalesce(s.responded_count, 0) > 0
        then round((s.accepted_count::numeric / s.responded_count) * 100)::integer
        else 0
      end as acceptance_rate,
      case when s.avg_response_seconds is not null
        then round(s.avg_response_seconds / 3600)::integer
        else null
      end as avg_response_hours
    from candidates c
    left join stats s on s.partner_id = c.id
  ),
  scored as (
    select
      r.id,
      case when coalesce(r.referral_count, 0) = 0 then null else
        round((
          (r.acceptance_rate / 100.0) * 5 * 0.5
          + least(r.sales_count::numeric / r.referral_count, 1) * 5 * 0.3
          + (case
              when r.avg_response_hours is null then 2.5
              else greatest(0, 5 - (r.avg_response_hours / 48.0) * 5)
            end) * 0.2
        ) * 10) / 10
      end as suggested_rating
    from rounded r
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
