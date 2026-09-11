drop function if exists public.get_partner_performance(text, text);

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
      and (p_to is null or pr.sent_at <= p_to::timestamptz)
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

revoke all on function public.get_partner_performance(text, text, uuid) from anon;
revoke all on function public.get_partner_performance(text, text, uuid) from public;
grant execute on function public.get_partner_performance(text, text, uuid) to authenticated;
