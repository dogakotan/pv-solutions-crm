-- Faz 4'ün ilk şemasından kalma; asla okunmadı/yazılmadı (tüm satırlarda
-- null) ve sonradan eklenen gerçek soft-delete mekanizması (deleted_at/
-- deleted_by + soft_delete_lead RPC) tarafından tamamen gölgede
-- bırakıldı — internal_notes'un aksine bu geçişte temizlenmemişti.
alter table public.leads drop column archived_at;
