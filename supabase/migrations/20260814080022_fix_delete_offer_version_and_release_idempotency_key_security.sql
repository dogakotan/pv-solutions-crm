-- İki mevcut RPC'de bu oturumdaki 4NF/RPC taşıma incelemesi sırasında
-- security advisor'ın yakaladığı açıklar:
--
-- 1) delete_offer_version: yetki kontrolü `if not (a or b) then raise`
--    biçimindeydi, coalesce(..., false) ile sarılmamıştı — anon/rolsüz
--    bir çağrıda current_role()/auth.uid() NULL döner, `NOT NULL` da
--    NULL olduğundan `IF NULL THEN` hiç çalışmaz ve exception
--    RAISE EDİLMEDEN devam eder. fix_null_propagation_in_rpc_permission_checks
--    migration'ından SONRA yazıldığı için aynı hatayı tekrarlamış.
--    Ayrıca ne public'ten ne anon'dan execute revoke edilmemişti.
--
-- 2) release_idempotency_key: hiçbir revoke yapılmamıştı (yalnızca
--    authenticated'e grant vardı, ama public/anon default olarak zaten
--    execute yetkisine sahipti).
--
-- İkisi de anon_security_definer_function_executable lint'inde
-- işaretlendi; delete_offer_version ayrıca gerçek bir yetkisiz-silme
-- riski taşıyordu.

create or replace function public.delete_offer_version(p_offer_version_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_offer_id uuid;
  v_status text;
  v_created_by uuid;
  v_remaining_count integer;
begin
  select offer_id, status, created_by
    into v_offer_id, v_status, v_created_by
  from public.offer_versions
  where id = p_offer_version_id;

  if v_offer_id is null then
    raise exception 'Teklif revizyonu bulunamadı.';
  end if;

  if not coalesce(
    private.current_role() = 'pv_admin' or v_created_by = auth.uid(),
    false
  ) then
    raise exception 'Bu revizyonu silme yetkiniz yok.';
  end if;

  if v_status = 'accepted' then
    raise exception 'Kabul edilmiş bir revizyon silinemez.';
  end if;

  delete from public.offer_versions where id = p_offer_version_id;

  select count(*) into v_remaining_count
  from public.offer_versions
  where offer_id = v_offer_id;

  if v_remaining_count = 0 then
    delete from public.offers where id = v_offer_id;
  end if;
end;
$$;

revoke execute on function public.delete_offer_version(uuid) from public;
revoke execute on function public.delete_offer_version(uuid) from anon;
grant execute on function public.delete_offer_version(uuid) to authenticated;

revoke execute on function public.release_idempotency_key(uuid) from public;
revoke execute on function public.release_idempotency_key(uuid) from anon;
grant execute on function public.release_idempotency_key(uuid) to authenticated;
