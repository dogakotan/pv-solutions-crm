-- Dördüncü tur — offer_versions_insert/offer_version_items_insert RLS
-- policy'leri hiçbir rol kontrolü yapmıyordu, sadece parent offer/version'ın
-- var olduğunu doğruluyordu. create_offer/revise_offer RPC'leri (table owner
-- olarak RLS'i zaten atlıyor) dışında, herhangi bir authenticated kullanıcı
-- (partner dahil) doğrudan PostgREST'e offer_versions'a status='accepted',
-- forge edilmiş created_by ile bir satır INSERT edebiliyordu — revise_offer'ın
-- garanti ettiği kilitleme/supersede mantığını tamamen atlayarak. Policy artık
-- create_offer/revise_offer'ın kendi izin kontrolüyle aynı: yalnızca pv_admin
-- veya lead'in sahibi olan pv_sales.
drop policy if exists offer_versions_insert on public.offer_versions;
create policy offer_versions_insert on public.offer_versions
for insert
with check (
  exists (
    select 1 from public.offers o
    join public.leads l on l.id = o.lead_id
    where o.id = offer_id
      and (
        private.current_role() = 'pv_admin'
        or (private.current_role() = 'pv_sales' and l.owner_id = auth.uid())
      )
  )
);

drop policy if exists offer_version_items_insert on public.offer_version_items;
create policy offer_version_items_insert on public.offer_version_items
for insert
with check (
  exists (
    select 1 from public.offer_versions ov
    join public.offers o on o.id = ov.offer_id
    join public.leads l on l.id = o.lead_id
    where ov.id = offer_version_id
      and (
        private.current_role() = 'pv_admin'
        or (private.current_role() = 'pv_sales' and l.owner_id = auth.uid())
      )
  )
);
