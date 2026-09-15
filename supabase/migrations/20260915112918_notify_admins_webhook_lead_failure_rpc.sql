-- Meta/Google Ads webhook route'ları lead oluşturma başarısız olduğunda
-- yalnızca sunucu loguna console.error yazıyordu — kaybolan bir reklam
-- lead'i hiçbir yerde görünür olmuyordu (yol haritası 5.3). Bu RPC,
-- service_role (webhook route'ları) tarafından çağrılır ve tüm aktif
-- pv_admin kullanıcılarına notifications tablosu üzerinden "high" öncelikli
-- bir bildirim düşer — mevcut notify_overdue_referrals ile aynı
-- "aktif pv_admin'lere yayınla" deseni.
--
-- dedup_key = 'webhook_lead_failure:' || p_source || ':' || p_external_ref
-- ile aynı external_ref için tekrar tekrar (örn. Meta retry) bildirim
-- spam'i önleniyor (ON CONFLICT DO NOTHING, idempotent).
create or replace function public.notify_admins_webhook_lead_failure(
  p_source text,
  p_external_ref text,
  p_error_message text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (recipient_user_id, type, title, message, priority, dedup_key)
  select
    ura.user_id, 'webhook_lead_failure', 'Reklam webhook''i lead oluşturamadı',
    p_source || ' (ref: ' || coalesce(p_external_ref, 'bilinmiyor') || '): ' || left(p_error_message, 500),
    'high',
    'webhook_lead_failure:' || p_source || ':' || coalesce(p_external_ref, gen_random_uuid()::text)
  from public.user_role_assignments ura
  join public.profiles pf on pf.id = ura.user_id
  where ura.role = 'pv_admin' and pf.is_active = true
  on conflict (dedup_key) do nothing;
end;
$$;

revoke execute on function public.notify_admins_webhook_lead_failure(text, text, text) from public;
revoke execute on function public.notify_admins_webhook_lead_failure(text, text, text) from anon;
revoke execute on function public.notify_admins_webhook_lead_failure(text, text, text) from authenticated;
grant execute on function public.notify_admins_webhook_lead_failure(text, text, text) to service_role;
