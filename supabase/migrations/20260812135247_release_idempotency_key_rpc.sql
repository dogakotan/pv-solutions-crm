-- Doğrudan `authenticated` rolünden idempotency_keys üzerinde DELETE,
-- RLS ile canlı ortamda gözlemlenebilir şekilde güvenilmez davrandı
-- (using(true) olan bir delete policy'sine rağmen PostgREST/JWT üzerinden
-- gelen isteklerde satır silinmiyordu — kökenini bu oturumda net şekilde
-- tespit edemedik). Bu projedeki diğer mutasyonlarla (assign_lead_to_partner,
-- record_sales_outcome vb.) tutarlı olacak şekilde, anahtar silme işlemini
-- de bir SECURITY DEFINER RPC'ye taşıyoruz — RLS'i tamamen devre dışı
-- bırakır, davranışı öngörülebilir ve test edilebilir kılar.
create or replace function public.release_idempotency_key(p_key uuid)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.idempotency_keys where key = p_key;
$$;

grant execute on function public.release_idempotency_key(uuid) to authenticated;

-- Artık kullanılmayan delete grant/policy'yi geri alıyoruz — silme işlemi
-- yalnızca yukarıdaki RPC üzerinden (owner bağlamında) yapılacak.
revoke delete on public.idempotency_keys from authenticated;
drop policy if exists idempotency_keys_delete on public.idempotency_keys;
