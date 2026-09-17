-- Altıncı tur inceleme, açık madde: get_first_call_qualified_trend
-- oluşturulduğunda diğer tüm ~50 RPC'nin aksine `revoke ... from anon`
-- hiç eklenmemişti (yalnızca `revoke ... from public` + `grant ... to
-- authenticated` vardı) — proje bootstrap'ının varsayılan ACL'i her yeni
-- fonksiyona anon'a da EXECUTE veriyor. Düşük risk (fonksiyonun kendi
-- WHERE changed_by = auth.uid() filtresi anon için boş sonuç veriyor)
-- ama projenin kendi checklist'ine (her yeni RPC'de anon'dan açıkça
-- revoke) aykırıydı. has_function_privilege ile doğrulandı: anon artık
-- çağıramıyor.
revoke execute on function public.get_first_call_qualified_trend(integer) from anon;
