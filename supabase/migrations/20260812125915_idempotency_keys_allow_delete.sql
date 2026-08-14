-- İlk migration'da idempotency_keys'e sadece insert yetkisi verilmişti.
-- Ama bir Server Action anahtarı tükettikten SONRA asıl mutasyon (örn.
-- lead insert) başarısız olursa, anahtarı geri almak (delete) gerekir —
-- aksi halde kullanıcının bir sonraki gerçek denemesi "zaten işlendi"
-- sayılıp kayıt hiç oluşturulmadan başarılı görünür. Silinen anahtar
-- rastgele bir token olduğundan (gerçek veri değil) sahiplik kontrolüne
-- gerek yok.
grant delete on public.idempotency_keys to authenticated;

create policy idempotency_keys_delete on public.idempotency_keys
for delete
to authenticated
using (true);
