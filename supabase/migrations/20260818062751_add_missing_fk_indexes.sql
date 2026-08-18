-- Supabase performans advisor'ının "unindexed foreign keys" uyarısı: bu
-- kolonların hepsi profiles(id)'ye referans veren audit-trail tipi alanlar
-- (created_by/updated_by/responded_by/changed_by/deleted_by) veya
-- sales_outcomes'un offer_versions'a referansı — hiçbiri henüz indexli değil.
-- Şu an veri hacmi küçük olduğu için sorun yaratmıyor ama profile bazlı
-- filtreleme/join büyüdükçe (örn. "bu kullanıcının oluşturduğu kayıtlar")
-- sıralı tarama gerektirecekti.
create index if not exists activities_created_by_idx on public.activities(created_by);
create index if not exists lead_internal_notes_updated_by_idx on public.lead_internal_notes(updated_by);
create index if not exists lead_stage_history_changed_by_idx on public.lead_stage_history(changed_by);
create index if not exists leads_created_by_idx on public.leads(created_by);
create index if not exists leads_deleted_by_idx on public.leads(deleted_by);
create index if not exists offer_versions_created_by_idx on public.offer_versions(created_by);
create index if not exists offers_created_by_idx on public.offers(created_by);
create index if not exists partner_internal_notes_updated_by_idx on public.partner_internal_notes(updated_by);
create index if not exists partner_referrals_referred_by_idx on public.partner_referrals(referred_by);
create index if not exists partner_referrals_responded_by_idx on public.partner_referrals(responded_by);
create index if not exists partners_created_by_idx on public.partners(created_by);
create index if not exists sales_outcomes_accepted_offer_version_id_idx on public.sales_outcomes(accepted_offer_version_id);
create index if not exists sales_outcomes_created_by_idx on public.sales_outcomes(created_by);
create index if not exists sales_outcomes_updated_by_idx on public.sales_outcomes(updated_by);
