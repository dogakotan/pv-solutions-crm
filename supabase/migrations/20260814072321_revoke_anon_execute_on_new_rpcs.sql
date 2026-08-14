-- Faz 12: security advisor taraması bu oturumda eklenen create_lead,
-- create_offer, revise_offer, create_partner, provision_partner_employee
-- RPC'lerinin anon (oturumsuz) tarafından çağrılabildiğini gösterdi —
-- revoke_anon_execute_on_rpcs / v2 migration'larında tespit edilen aynı
-- kök neden: Supabase yeni fonksiyonlara PUBLIC'in yanı sıra anon/
-- authenticated'e DOĞRUDAN EXECUTE veriyor, "revoke ... from public"
-- bunu kapatmaya yetmiyor.
revoke execute on function public.create_lead(text, text, text, text, text, uuid) from anon;
revoke execute on function public.create_offer(uuid, numeric, text, boolean, date, text, text, text, jsonb) from anon;
revoke execute on function public.revise_offer(uuid, numeric, text, boolean, date, text, text, text, jsonb) from anon;
revoke execute on function public.create_partner(text, text, text, text, text, text, text, text, text, uuid, text, text[], text[]) from anon;
revoke execute on function public.provision_partner_employee(uuid, uuid, text, public.app_role) from anon;
