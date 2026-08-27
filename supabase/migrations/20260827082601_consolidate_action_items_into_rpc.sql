-- getActionItems (leads.ts) iki ayrı sorguyu (gecikmiş takip + gecikmiş
-- partner yanıtı) Promise.all ile çekip JS'te birleştirip sıralıyordu.
-- Tek RPC'ye indirildi: UNION ALL + tek order by/limit. SECURITY DEFINER
-- değil — invoker olarak RLS otomatik uygulanıyor (partner rolü sadece
-- kendi yönlendirmelerini/leadlerini görür).
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
  )
  select * from (
    select * from follow_up
    union all
    select * from referral
  ) combined
  order by due_at asc
  limit p_limit;
$$;

revoke all on function public.get_action_items(integer) from anon;
