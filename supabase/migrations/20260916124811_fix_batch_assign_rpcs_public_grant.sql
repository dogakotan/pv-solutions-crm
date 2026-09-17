-- Bir önceki migration, yeni oluşturulan fonksiyonların otomatik aldığı
-- PUBLIC pseudo-role EXECUTE grant'ini fark etmemişti — yalnızca anon'dan
-- revoke etmek yetersizdi, çünkü anon PUBLIC üzerinden yetkiyi miras
-- alıyordu. get_advisors ile fark edilip düzeltildi.
revoke execute on function public.assign_leads_to_sales_batch(uuid[], uuid) from public;
revoke execute on function public.assign_leads_to_partner_batch(uuid[], uuid, uuid, timestamptz, text) from public;
