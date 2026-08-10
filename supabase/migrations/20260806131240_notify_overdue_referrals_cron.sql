-- =========================================================
-- Faz 9: gecikmiş partner yanıtı bildirimi — bu, doküman 12.4'te
-- referans verilen "pg_cron gecikme bildirimi job'ı" (notifications_core.sql
-- yorumunda ertelenmişti). Zaman bazlı bir koşul (response_due_at geçti)
-- olduğu için tekil bir RPC olayına bağlanamaz; periyodik taranması gerekir.
--
-- dedup_key = 'referral_overdue:' || referral_id ile UNIQUE kısıtlaması
-- üzerinden ON CONFLICT DO NOTHING kullanılıyor — job her 30 dakikada
-- bir çalışsa da aynı gecikmiş yönlendirme için yalnızca BİR bildirim
-- üretilir (idempotent).
-- =========================================================

create or replace function private.notify_overdue_referrals()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (recipient_user_id, type, title, message, entity_type, entity_id, priority, dedup_key)
  select
    recipient_user_id, 'referral_overdue', 'Partner yanıtı gecikti',
    l.lead_no || ' — ' || l.customer_name || ' (' || p.name || ')',
    'referral', pr.id, 'high',
    'referral_overdue:' || pr.id || ':' || recipient_user_id
  from public.partner_referrals pr
  join public.leads l on l.id = pr.lead_id
  join public.partners p on p.id = pr.partner_id
  cross join lateral (
    select ura.user_id as recipient_user_id
    from public.user_role_assignments ura
    join public.profiles pf on pf.id = ura.user_id
    where ura.role = 'pv_admin' and pf.is_active = true
    union
    select pr.referred_by where pr.referred_by is not null
  ) recipients
  where pr.status = 'pending'
    and pr.closed_at is null
    and pr.response_due_at < now()
  on conflict (dedup_key) do nothing;
end;
$$;

revoke execute on function private.notify_overdue_referrals() from public;

create extension if not exists pg_cron with schema extensions;

select cron.schedule(
  'notify-overdue-referrals',
  '*/30 * * * *',
  $$select private.notify_overdue_referrals()$$
);
