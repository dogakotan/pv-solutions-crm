-- first_call'ın puanladığı ama 24 saattir satışa devredilmemiş
-- leadleri hiçbir yerde görünmüyordu (get_first_call_lead_kpis'in
-- ready_for_sales sayacı sadece bir sayı, hangi leadler olduğunu
-- göstermiyor) — first_call bunu "unutabiliyordu". Yeni
-- ready_for_sales_stale nedeni, RLS zaten first_call'ı kendi
-- leadleriyle sınırladığı için ek bir rol kontrolüne gerek kalmadan
-- doğal olarak sadece first_call/admin'e görünür (sales/partner'ın
-- görebildiği leadlerde sales_user_id zaten dolu).

create or replace function public.get_action_items(p_limit integer default 20)
returns table (
  id text,
  lead_id uuid,
  lead_no text,
  customer_name text,
  city text,
  stage text,
  reason text,
  due_at timestamptz
)
language sql
stable
set search_path = public
as $$
  with follow_up as (
    select
      'lead-' || l.id::text as id,
      l.id as lead_id,
      coalesce(l.lead_no, '') as lead_no,
      l.customer_name,
      l.city,
      l.stage,
      'follow_up_overdue' as reason,
      l.next_follow_up_at as due_at
    from public.leads l
    where l.deleted_at is null
      and l.stage not in ('won', 'lost', 'sale_registered')
      and l.next_follow_up_at is not null
      and l.next_follow_up_at < now()
  ),
  referral as (
    select
      'referral-' || pr.id::text as id,
      l.id as lead_id,
      l.lead_no,
      l.customer_name,
      l.city,
      l.stage,
      'partner_response_overdue' as reason,
      pr.response_due_at as due_at
    from public.partner_referrals pr
    join public.leads l on l.id = pr.lead_id
    where pr.status = 'pending'
      and pr.response_due_at < now()
  ),
  unassigned_ready as (
    select
      'unassigned-' || l.id::text as id,
      l.id as lead_id,
      coalesce(l.lead_no, '') as lead_no,
      l.customer_name,
      l.city,
      l.stage,
      'ready_for_sales_stale' as reason,
      l.updated_at as due_at
    from public.leads l
    where l.deleted_at is null
      and l.lead_score is not null
      and l.sales_user_id is null
      and l.stage not in ('won', 'lost', 'sale_registered')
      and l.updated_at < now() - interval '24 hours'
  )
  select * from (
    select * from follow_up
    union all
    select * from referral
    union all
    select * from unassigned_ready
  ) combined
  order by due_at asc
  limit p_limit;
$$;

revoke all on function public.get_action_items(integer) from anon;
