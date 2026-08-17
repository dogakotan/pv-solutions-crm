-- partner_referrals.status zaten 'expired' değerini destekliyor,
-- ReferralStatusBadge bunu render ediyor ve "başarısız yönlendirme"
-- istatistiğine dahil ediliyor (bkz. getPartnerReferralKpis) — ama
-- hiçbir yer bu duruma geçiş yapmıyordu. notify_overdue_referrals
-- (bkz. notify_overdue_referrals_cron.sql) aynı koşulu (response_due_at
-- geçmiş, hâlâ pending) zaten tarıyor ama yalnızca bildirim üretiyor,
-- satırı hiç güncellemiyor.
--
-- response_due_at < now() - interval '30 minutes' eşiği kasıtlı:
-- notify_overdue_referrals de 30 dakikada bir çalışıyor, bu yüzden bu
-- eşik alıcının süresi geçmeden ÖNCE en az bir bildirim döngüsü
-- almasını garanti eder — iki bağımsız cron job'ın faz kaymasına göre
-- expire'ın notify'dan önce çalışıp kimseye haber vermeden süreyi
-- doldurmasını engeller.
create or replace function private.expire_stale_partner_referrals()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.partner_referrals
  set status = 'expired', closed_at = now()
  where status = 'pending'
    and closed_at is null
    and response_due_at < now() - interval '30 minutes';
end;
$$;

revoke execute on function private.expire_stale_partner_referrals() from public;

select cron.schedule(
  'expire-stale-partner-referrals',
  '*/30 * * * *',
  $$select private.expire_stale_partner_referrals()$$
);
