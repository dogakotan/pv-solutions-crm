-- Bu 4 fonksiyon, sırasıyla getAdminLeadKpis/getFirstCallLeadKpis/
-- getSalesLeadKpis/getPartnerReferralKpis'te 5-10 ayrı count sorgusuyla
-- Promise.all üzerinden yapılan işi tek round trip'e indiriyor. Hiçbiri
-- SECURITY DEFINER DEĞİL — invoker olarak çağıranın rolüyle çalışıyor,
-- bu yüzden leads/partner_referrals RLS politikaları normal .from()
-- sorgusundaymış gibi otomatik uygulanıyor (partner'ın sadece kendi
-- yönlendirmelerini görmesi gibi). Sayım filtreleri orijinal TS
-- sorgularıyla birebir aynı — hangi count'un deleted_at/embed filtresi
-- olduğu değiştirilmedi.

create or replace function public.get_admin_lead_kpis()
returns table (
  total bigint,
  new_leads bigint,
  awaiting_first_call bigint,
  assigned_to_sales bigint,
  awaiting_partner bigint,
  overdue_partner bigint,
  survey bigint,
  proposal bigint,
  won bigint,
  lost bigint
)
language sql
stable
set search_path = public
as $$
  select
    l.total, l.new_leads, l.awaiting_first_call, l.assigned_to_sales,
    l.survey, l.proposal, l.won, l.lost,
    r.awaiting_partner, r.overdue_partner
  from (
    select
      count(*) filter (where deleted_at is null) as total,
      count(*) filter (where stage = 'new') as new_leads,
      count(*) filter (where stage = 'new' and first_call_user_id is null) as awaiting_first_call,
      count(*) filter (where sales_user_id is not null) as assigned_to_sales,
      count(*) filter (where stage in ('survey_scheduled','survey_completed')) as survey,
      count(*) filter (where stage in ('proposal_preparing','proposal_sent')) as proposal,
      count(*) filter (where stage = 'won') as won,
      count(*) filter (where stage = 'lost') as lost
    from public.leads
  ) l
  cross join (
    select
      count(*) filter (where status = 'pending') as awaiting_partner,
      count(*) filter (where status = 'pending' and response_due_at < now()) as overdue_partner
    from public.partner_referrals
  ) r;
$$;

create or replace function public.get_first_call_lead_kpis(p_start timestamptz, p_end timestamptz)
returns table (
  new_assigned bigint,
  due_today bigint,
  contacted bigint,
  unscored bigint,
  ready_for_sales bigint
)
language sql
stable
set search_path = public
as $$
  select
    count(*) filter (where stage = 'new') as new_assigned,
    count(*) filter (where next_follow_up_at >= p_start and next_follow_up_at <= p_end) as due_today,
    count(*) filter (where stage = 'contacted') as contacted,
    count(*) filter (where lead_score is null and stage <> 'new') as unscored,
    count(*) filter (where lead_score is not null and sales_user_id is null) as ready_for_sales
  from public.leads;
$$;

create or replace function public.get_sales_lead_kpis(p_start timestamptz, p_end timestamptz)
returns table (
  total bigint,
  due_today bigint,
  won bigint,
  lost bigint,
  overdue_partner bigint
)
language sql
stable
set search_path = public
as $$
  select
    l.total, l.due_today, l.won, l.lost, r.overdue_partner
  from (
    select
      count(*) filter (where deleted_at is null) as total,
      count(*) filter (where next_follow_up_at >= p_start and next_follow_up_at <= p_end) as due_today,
      count(*) filter (where stage = 'won') as won,
      count(*) filter (where stage = 'lost') as lost
    from public.leads
  ) l
  cross join (
    select count(*) filter (where status = 'pending' and response_due_at < now()) as overdue_partner
    from public.partner_referrals
  ) r;
$$;

create or replace function public.get_partner_referral_kpis()
returns table (
  total bigint,
  pending bigint,
  overdue bigint,
  completed bigint,
  unsuccessful bigint,
  survey_planned bigint,
  proposal_preparing bigint,
  negotiation bigint
)
language sql
stable
set search_path = public
as $$
  select
    pr.total, pr.pending, pr.overdue, pr.completed, pr.unsuccessful,
    j.survey_planned, j.proposal_preparing, j.negotiation
  from (
    select
      count(*) as total,
      count(*) filter (where status = 'pending') as pending,
      count(*) filter (where status = 'pending' and response_due_at < now()) as overdue,
      count(*) filter (where status = 'completed') as completed,
      count(*) filter (where status in ('rejected','cancelled','expired')) as unsuccessful
    from public.partner_referrals
  ) pr
  cross join (
    select
      count(*) filter (where l.stage = 'survey_scheduled') as survey_planned,
      count(*) filter (where l.stage = 'proposal_preparing') as proposal_preparing,
      count(*) filter (where l.stage = 'negotiation') as negotiation
    from public.partner_referrals pr2
    join public.leads l on l.id = pr2.lead_id
  ) j;
$$;

revoke all on function public.get_admin_lead_kpis() from anon;
revoke all on function public.get_first_call_lead_kpis(timestamptz, timestamptz) from anon;
revoke all on function public.get_sales_lead_kpis(timestamptz, timestamptz) from anon;
revoke all on function public.get_partner_referral_kpis() from anon;
