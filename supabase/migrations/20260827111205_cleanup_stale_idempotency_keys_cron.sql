-- add_idempotency_keys migration'ında not edilmişti: "Süresi dolmuş
-- anahtarların temizliği (ileride bir cron/RPC ile) şimdilik kapsam
-- dışı — satır boyutu ihmal edilebilir düzeyde." Veri kontrolünde
-- tablo hiç temizlenmediği görüldü (75 kayıt, hepsi >1 gün eski,
-- en eskisi 4 gün, en yenisi de zaten günler önce üretilmiş) — anahtar
-- tek kullanımlık olduğu için 24 saatten eski bir kayıt artık hiçbir
-- işe yaramaz, süresiz birikir. Diğer expire/notify cron'larıyla aynı
-- desen (private şema, security definer, 30 dakikada bir).
create or replace function private.cleanup_stale_idempotency_keys()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.idempotency_keys
  where created_at < now() - interval '24 hours';
$$;

revoke execute on function private.cleanup_stale_idempotency_keys() from public;

select cron.schedule(
  'cleanup-stale-idempotency-keys',
  '*/30 * * * *',
  $$select private.cleanup_stale_idempotency_keys()$$
);
