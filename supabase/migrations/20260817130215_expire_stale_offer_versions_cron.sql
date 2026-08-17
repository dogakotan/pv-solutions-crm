-- =========================================================
-- offer_versions.status zaten 'expired' değerini destekliyor
-- (bkz. offers_and_versions_core.sql check constraint) ve UI
-- bunu badge olarak render ediyor, ama hiçbir yerde bu duruma
-- geçiş yapılmıyordu — valid_until geçmiş bir 'sent' revizyon
-- süresiz olarak 'sent' kalıyordu.
--
-- notify_overdue_referrals ile aynı desen: zaman bazlı bir koşul
-- olduğu için tekil bir RPC olayına bağlanamaz, periyodik taranması
-- gerekir. dedup_key = 'offer_expired:' || offer_version_id ile
-- ON CONFLICT DO NOTHING kullanılıyor — job her 30 dakikada bir
-- çalışsa da aynı revizyon için yalnızca BİR bildirim üretilir.
-- UPDATE'in kendisi de doğal olarak idempotent: durum 'sent'
-- olmaktan çıktığı için bir sonraki çalıştırmada WHERE eşleşmez.
-- =========================================================

create or replace function private.expire_stale_offer_versions()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  with expired as (
    update public.offer_versions
    set status = 'expired'
    where status = 'sent'
      and valid_until is not null
      and valid_until < current_date
    returning id, offer_id, created_by
  )
  insert into public.notifications (recipient_user_id, type, title, message, entity_type, entity_id, priority, dedup_key)
  select
    e.created_by, 'offer_expired', 'Teklifin süresi doldu',
    l.lead_no || ' — ' || l.customer_name,
    'offer', e.offer_id, 'normal',
    'offer_expired:' || e.id
  from expired e
  join public.offers o on o.id = e.offer_id
  join public.leads l on l.id = o.lead_id
  on conflict (dedup_key) do nothing;
end;
$$;

revoke execute on function private.expire_stale_offer_versions() from public;

select cron.schedule(
  'expire-stale-offer-versions',
  '*/30 * * * *',
  $$select private.expire_stale_offer_versions()$$
);
