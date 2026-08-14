-- Teklif Excel çıktısının ihtiyaç duyduğu kalem bazlı veriler:
-- ödeme şekli / nakliye (offer_versions'a serbest metin alan) ve
-- ürün kalemleri (yeni tablo — kod/isim/adet/birim fiyat).

alter table public.offer_versions
  add column payment_method text,
  add column shipping_terms text;

create table public.offer_version_items (
  id uuid primary key default gen_random_uuid(),
  offer_version_id uuid not null references public.offer_versions(id) on delete cascade,
  product_code text,
  product_name text not null,
  quantity numeric not null check (quantity > 0),
  unit_price numeric(14,2) not null check (unit_price >= 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

comment on table public.offer_version_items is 'offer_versions gibi immutable kabul edilir — bir kalem hatalıysa yeni revizyon açılır, mevcut kalem güncellenmez/silinmez.';

create index offer_version_items_offer_version_id_idx on public.offer_version_items(offer_version_id);

-- ---------------------------------------------------------
-- RLS: offer_version_items (görünürlük parent offer_versions'a bağlı,
-- offer_versions_select/insert ile aynı desen — iç sorgu zaten parent
-- tablonun kendi RLS'ini bu kullanıcı için uygular)
-- ---------------------------------------------------------
alter table public.offer_version_items enable row level security;

revoke all on public.offer_version_items from anon;
grant select, insert on public.offer_version_items to authenticated;

create policy offer_version_items_select on public.offer_version_items
for select
using (exists (select 1 from public.offer_versions ov where ov.id = offer_version_id));

create policy offer_version_items_insert on public.offer_version_items
for insert
with check (exists (select 1 from public.offer_versions ov where ov.id = offer_version_id));
