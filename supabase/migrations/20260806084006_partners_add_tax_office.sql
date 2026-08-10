-- =========================================================
-- Frontend'de daha önce eklenen "Bağlı olduğu vergi dairesi" alanının
-- backend karşılığı. Mock veriden gerçek sorguya geçiş kapsamında.
-- =========================================================
alter table public.partners add column tax_office text;
