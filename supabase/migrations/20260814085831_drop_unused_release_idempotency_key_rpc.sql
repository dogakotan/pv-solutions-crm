-- create_lead RPC artik idempotency key + lead insert'i tek transaction'da
-- atomik yapiyor (bkz. create_lead_rpc migration'i), bu yuzden basarisiz
-- insert'i elle geri almak icin kullanilan bu fonksiyon artik hicbir yerden
-- cagrilmiyor (src/ tarandi, cagrı yok). Olu kod olarak kaldiriliyor.
drop function if exists public.release_idempotency_key(uuid);
