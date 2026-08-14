-- Kapasite (kWp) bir ürün/kalem değil, teklifin ticari içeriğine dahil
-- edilmesi anlamsız bir alandı (kullanıcı: "kapasite yok ürün satıyoruz
-- aslında") — teklifler artık tamamen ürün kalemlerinden (offer_version_items)
-- oluşuyor. Sütun kaldırılıyor; lead'in kendi teknik değerlendirmesindeki
-- leads.estimated_capacity_kwp bundan bağımsız, dokunulmuyor.
alter table public.offer_versions drop column capacity_kwp;
