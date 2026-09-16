-- Dördüncü tur inceleme, madde: raporlardaki "Bitiş" tarih filtresi
-- created_at/sent_at <= p_to::timestamptz kullanıyordu. p_to,
-- <input type="date">'den gelen çıplak bir tarih (ör. "2026-09-16") —
-- timestamptz'ye cast edilince gece yarısı (00:00:00) oluyor, bu da
-- filtreyi "seçilen bitiş gününün neredeyse tamamını hariç tut"a
-- çeviriyor. "Bugüne kadar" seçilince o günün verisi neredeyse hiç
-- gelmiyordu. Dört rapor RPC'sinde de üst sınır artık p_to'nun bir
-- SONRAKİ gününün gece yarısından ÖNCE (exclusive) olacak şekilde
-- düzeltildi — seçilen bitiş gününün tamamını kapsıyor.
create or replace function public.get_lead_funnel(p_from text default null, p_to text default null)
returns table (stage text, count bigint)
language sql
stable
set search_path = public
as $$
  select stage, count(*) as count
  from public.leads
  where deleted_at is null
    and (p_from is null or created_at >= p_from::timestamptz)
    and (p_to is null or created_at < (p_to::date + 1)::timestamptz)
  group by stage;
$$;

create or replace function public.get_source_conversion(p_from text default null, p_to text default null)
returns table (source text, total bigint, won bigint, lost bigint)
language sql
stable
set search_path = public
as $$
  select
    source,
    count(*) as total,
    count(*) filter (where stage = 'won') as won,
    count(*) filter (where stage = 'lost') as lost
  from public.leads
  where deleted_at is null
    and (p_from is null or created_at >= p_from::timestamptz)
    and (p_to is null or created_at < (p_to::date + 1)::timestamptz)
  group by source;
$$;

create or replace function public.get_salesperson_performance(p_from text default null, p_to text default null)
returns table (
  sales_user_id uuid,
  sales_user_name text,
  new_count bigint,
  open_count bigint,
  won bigint,
  lost bigint,
  offers_sent bigint,
  won_amounts jsonb
)
language sql
stable
set search_path = public
as $$
  with scoped_leads as (
    select l.id, l.owner_id, l.stage
    from public.leads l
    join public.user_role_assignments ura on ura.user_id = l.owner_id and ura.role = 'pv_sales'
    where l.deleted_at is null
      and (p_from is null or l.created_at >= p_from::timestamptz)
      and (p_to is null or l.created_at < (p_to::date + 1)::timestamptz)
  ),
  by_owner as (
    select
      owner_id,
      count(*) filter (where stage = 'new') as new_count,
      count(*) filter (where stage not in ('won', 'lost', 'sale_registered')) as open_count,
      count(*) filter (where stage = 'won') as won,
      count(*) filter (where stage = 'lost') as lost
    from scoped_leads
    group by owner_id
  ),
  offers_by_owner as (
    select sl.owner_id, count(*) as offers_sent
    from public.offers o
    join scoped_leads sl on sl.id = o.lead_id
    group by sl.owner_id
  ),
  won_by_owner as (
    select owner_id2 as owner_id, jsonb_agg(jsonb_build_object('currency', currency, 'amount', amount) order by currency) as won_amounts
    from (
      select sl.owner_id as owner_id2, so.currency, sum(so.final_amount) as amount
      from public.sales_outcomes so
      join scoped_leads sl on sl.id = so.lead_id
      where so.outcome = 'won' and so.final_amount is not null and so.currency is not null
      group by sl.owner_id, so.currency
    ) cur
    group by owner_id2
  )
  select
    bo.owner_id as sales_user_id,
    coalesce(p.full_name, '—') as sales_user_name,
    bo.new_count, bo.open_count, bo.won, bo.lost,
    coalesce(ob.offers_sent, 0) as offers_sent,
    coalesce(wb.won_amounts, '[]'::jsonb) as won_amounts
  from by_owner bo
  join public.profiles p on p.id = bo.owner_id
  left join offers_by_owner ob on ob.owner_id = bo.owner_id
  left join won_by_owner wb on wb.owner_id = bo.owner_id;
$$;

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
      count(*) filter (where status in ('accepted', 'completed')) as accepted_count,
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

-- leads.stage, offers/offer_versions/partner_referrals'ın aksine hiçbir
-- guard trigger ile korunmuyordu — protect_lead_privileged_columns bile
-- stage'i kapsamıyor (advance_lead_stage RPC'sinin kendi yorumunda
-- kasıtlı olarak belirtiliyor). Bu yüzden herhangi bir pv_admin/lead
-- sahibi pv_sales, doğrudan bir .update() ile leads.stage'i hiçbir
-- doğrulama olmadan 'won'/'lost'tan 'new'a döndürebiliyordu. İlk turda
-- offers/offer_versions/partner_referrals'a eklenen dar guard deseninin
-- aynısı: yalnızca kesinleşmiş (won/lost) bir aşamadan başlangıç
-- aşamasına dönüşü engelliyor. reactivate_lead RPC'si won/lost'u
-- 'contacted'a döndürüyor, 'new'a değil — bu yüzden dokunulmuyor.
create or replace function private.enforce_leads_stage_transition()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if old.stage in ('won', 'lost') and new.stage = 'new' then
    raise exception 'Geçersiz lead aşama geçişi: % -> % (kesinleşmiş bir lead başlangıç aşamasına döndürülemez)', old.stage, new.stage;
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_leads_stage_transition on public.leads;
create trigger enforce_leads_stage_transition
before update of stage on public.leads
for each row
when (old.stage is distinct from new.stage)
execute function private.enforce_leads_stage_transition();
