-- Bazı form gönderimlerinin ağ seviyesinde tekrarlanması (çift tıklama
-- değil — client tarafı bunu zaten disabled={pending} ile engelliyor;
-- burada kastedilen bir isteğin ağ katmanında iki kez sunucuya ulaşması)
-- durumunda çift kayıt oluşmasını önlemek için minimal bir anahtar
-- tablosu. Client, form her mount olduğunda tek bir rastgele anahtar
-- üretir; sunucu bu anahtarı ilk kullanımda buraya yazar, ikinci
-- denemede unique ihlali alır ve işlemi tekrarlamadan aynı sonucu
-- döner. Süresi dolmuş anahtarların temizliği (ileride bir cron/RPC ile)
-- şimdilik kapsam dışı — satır boyutu ihmal edilebilir düzeyde.
create table public.idempotency_keys (
  key uuid primary key,
  created_at timestamptz not null default now()
);

comment on table public.idempotency_keys is 'Tek kullanımlık client-üretimli anahtarlar — form gönderiminin ağ seviyesinde tekrarını (çift kayıt) engellemek için. Şifre/token/secret İÇERMEZ.';

alter table public.idempotency_keys enable row level security;

revoke all on public.idempotency_keys from anon;
grant insert on public.idempotency_keys to authenticated;

create policy idempotency_keys_insert on public.idempotency_keys
for insert
to authenticated
with check (true);
