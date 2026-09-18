-- Dokuzuncu tur inceleme, düşük öncelik (genel tutarlılık boşluğu): birkaç
-- private şema fonksiyonu, tüm kod tabanının genelinde uygulanan
-- "PUBLIC'ten revoke et, yalnızca gereken role grant et" (bkz.
-- private.current_role/private.lead_not_deleted/private.set_updated_at)
-- deseninin dışında kalmıştı. Bu fonksiyonlar PostgREST'in yalnızca
-- `public` şemasını expose etmesi nedeniyle REST üzerinden zaten
-- çağrılamıyordu, ama gereksiz PUBLIC/anon EXECUTE yetkisi bırakmak
-- (örn. doğrudan bir Postgres bağlantısı üzerinden) savunma derinliği
-- açısından bir tutarsızlıktı.
--
-- Trigger fonksiyonları (enforce_*/protect_*/log_lead_stage_change/
-- generate_lead_no): PostgreSQL trigger çağırma mekanizması, tetikleyen
-- rolün fonksiyon üzerinde EXECUTE yetkisine sahip olmasını GEREKTİRMEZ
-- (private.set_updated_at zaten hiç kimseye EXECUTE vermeden aynı şekilde
-- çalışıyor) — bu yüzden authenticated dahil tüm rollerden tamamen
-- kaldırılabilir.
revoke execute on function private.generate_lead_no() from public, anon, authenticated;
revoke execute on function private.log_lead_stage_change() from public, anon, authenticated;
revoke execute on function private.enforce_leads_stage_transition() from public, anon, authenticated;
revoke execute on function private.enforce_offer_versions_status_transition() from public, anon, authenticated;
revoke execute on function private.enforce_offers_status_transition() from public, anon, authenticated;
revoke execute on function private.enforce_partner_referrals_status_transition() from public, anon, authenticated;
revoke execute on function private.protect_notification_immutable_fields() from public, anon, authenticated;
revoke execute on function private.protect_offer_versions_immutable_fields() from public, anon, authenticated;
revoke execute on function private.protect_offers_privileged_columns() from public, anon, authenticated;

-- current_partner_id: RLS politikalarının içinden 'authenticated' bağlamında
-- doğrudan çağrılıyor (bkz. 20260805104721) — o grant korunuyor, yalnızca
-- private.current_role() ile aynı şekilde public/anon kapatılıyor.
revoke execute on function private.current_partner_id() from public, anon;
grant execute on function private.current_partner_id() to authenticated;
