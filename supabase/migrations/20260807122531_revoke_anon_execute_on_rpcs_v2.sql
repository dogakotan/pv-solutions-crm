-- İlk deneme (revoke ... from public) yetmedi: Supabase, public şemadaki
-- yeni fonksiyonlara otomatik olarak anon/authenticated/service_role'e
-- DOĞRUDAN (yalnızca PUBLIC üzerinden değil) EXECUTE grant'i veriyor —
-- tablolar için zaten bilinen "her migration'da revoke all from anon"
-- gerekliliğinin fonksiyonlar için de geçerli olduğu doğrulandı.
revoke execute on function public.find_duplicate_leads_by_phone(text) from anon;
revoke execute on function public.record_sales_outcome(uuid, text, uuid, numeric, text, text, text, date, text) from anon;
