-- Partner performans puanı (0.0-5.0 arası, ondalıklı) — mevcut satış/
-- yönlendirme istatistiklerinin (conversionRate) yerini alacak, admin
-- tarafından manuel girilen bir performans/memnuniyet skoru.
alter table public.partners
  add column rating numeric(2,1);

alter table public.partners
  add constraint partners_rating_range_check
  check (rating is null or (rating >= 0 and rating <= 5));
