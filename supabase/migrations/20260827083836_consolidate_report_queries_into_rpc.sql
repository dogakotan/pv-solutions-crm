-- reports.ts'teki 6 fonksiyon (getLeadFunnel, getSourceConversion,
-- getSalespersonPerformance, getPartnerPerformance, getLostReasons,
-- getMonthlyWonAmount) her biri tüm eşleşen satırları çekip JS'te
-- group-by/aggregate yapıyordu (bazıları 3-4 round trip). Hepsi tek
-- sorguluk RPC'lere taşındı, aggregation SQL tarafında. SECURITY
-- DEFINER değil — invoker olarak RLS otomatik uygulanıyor (/reports
-- zaten admin-özel, ama bu fonksiyonlar rol bazlı ayrım yapmıyor,
-- RLS'in verdiği satır kümesi üzerinde çalışıyor — leads.ts'teki
-- aynı desen).
--
-- Tarih aralığı parametreleri metin (YYYY-MM-DD) olarak geliyor,
-- <input type="date"> formundan; orijinal .gte()/.lte() filtreleriyle
-- aynı davranış için ilgili kolon tipine göre cast ediliyor.

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
    and (p_to is null or created_at <= p_to::timestamptz)
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
    and (p_to is null or created_at <= p_to::timestamptz)
  group by source;
$$;

-- leads.owner_id yaşam döngüsü boyunca el değiştirir (first_call → sales);
-- yalnızca şu an pv_sales rolünde olan sahiplerle sınırlanıyor (orijinal
-- TS yorumuyla aynı gerekçe).
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
      and (p_to is null or l.created_at <= p_to::timestamptz)
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

create or replace function public.get_partner_performance(p_from text default null, p_to text default null)
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
      and (p_to is null or pr.sent_at <= p_to::timestamptz)
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

create or replace function public.get_lost_reasons(p_from text default null, p_to text default null)
returns table (reason text, count bigint)
language sql
stable
set search_path = public
as $$
  select coalesce(lost_reason, 'Belirtilmemiş') as reason, count(*) as count
  from public.sales_outcomes
  where outcome = 'lost'
    and (p_from is null or result_date >= p_from::date)
    and (p_to is null or result_date <= p_to::date)
  group by coalesce(lost_reason, 'Belirtilmemiş');
$$;

create or replace function public.get_monthly_won_amount(p_from text default null, p_to text default null)
returns table (month text, currency text, total_amount numeric)
language sql
stable
set search_path = public
as $$
  select
    to_char(date_trunc('month', result_date), 'YYYY-MM') as month,
    currency,
    sum(final_amount) as total_amount
  from public.sales_outcomes
  where outcome = 'won'
    and final_amount is not null
    and currency is not null
    and (p_from is null or result_date >= p_from::date)
    and (p_to is null or result_date <= p_to::date)
  group by date_trunc('month', result_date), currency;
$$;

revoke all on function public.get_lead_funnel(text, text) from anon;
revoke all on function public.get_source_conversion(text, text) from anon;
revoke all on function public.get_salesperson_performance(text, text) from anon;
revoke all on function public.get_partner_performance(text, text) from anon;
revoke all on function public.get_lost_reasons(text, text) from anon;
revoke all on function public.get_monthly_won_amount(text, text) from anon;
