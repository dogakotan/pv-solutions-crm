-- Dokuzuncu tur inceleme, orta öncelik (2 madde):
--
-- 1) notify_admins_webhook_lead_duplicate bildirimi entity_type/entity_id
--    hiç doldurmuyordu — diğer tüm bildirimlerin aksine, adminin bildirimler
--    listesinde tıklanabilir/lead'e giden bir bağlantısı yoktu.
--
-- 2) find_duplicate_leads_by_phone (manuel lead oluşturmadaki duplicate
--    uyarısı) ham string eşitliğiyle çalışıyordu; aynı numaranın
--    "+905551234567" / "05551234567" / "5551234567" biçimleri birbirini
--    yakalamıyordu — 20260918100000 ile webhook yoluna eklenen
--    private.normalize_tr_phone tabanlı karşılaştırmayla tutarsızdı. Artık
--    ikisi de aynı normalizasyonu kullanıyor.
create or replace function private.notify_admins_webhook_lead_duplicate(
  p_source text,
  p_external_ref text,
  p_phone text,
  p_existing_lead_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (recipient_user_id, type, title, message, entity_type, entity_id, priority, dedup_key)
  select
    ura.user_id, 'webhook_lead_duplicate', 'Webhook lead tekrarı algılandı',
    p_source || ' üzerinden gelen bir lead (ref: ' || coalesce(p_external_ref, 'bilinmiyor') ||
      '), açık bir lead ile aynı telefon numarasını (' || p_phone || ') paylaştığı için ayrıca oluşturulmadı.',
    'lead', p_existing_lead_id,
    'normal',
    'webhook_lead_duplicate:' || p_source || ':' || coalesce(p_external_ref, gen_random_uuid()::text)
  from public.user_role_assignments ura
  join public.profiles pf on pf.id = ura.user_id
  where ura.role = 'pv_admin' and pf.is_active = true
  on conflict (dedup_key) do nothing;
end;
$$;

revoke execute on function private.notify_admins_webhook_lead_duplicate(text, text, text, uuid) from public;

create or replace function public.find_duplicate_leads_by_phone(p_phone text)
returns table (id uuid, lead_no text, customer_name text, stage text, created_at timestamptz)
language sql
security definer
set search_path to 'public'
stable
as $$
  select id, lead_no, customer_name, stage, created_at
  from public.leads
  where deleted_at is null
    and (private.normalize_tr_phone(phone) = private.normalize_tr_phone(p_phone)
         or private.normalize_tr_phone(alternate_phone) = private.normalize_tr_phone(p_phone))
  order by created_at desc
  limit 5;
$$;

grant execute on function public.find_duplicate_leads_by_phone(text) to authenticated;
