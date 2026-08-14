-- Yanlışlıkla girilmiş bir teklif revizyonunu kalıcı olarak silmek için
-- SECURITY DEFINER RPC. Doğrudan tablo DELETE'i (offer_versions_update
-- gibi bir RLS policy'siyle) bu oturumda daha önce authenticated rolü
-- için güvenilmez bulunmuştu (bkz. release_idempotency_key_rpc
-- migration'ı) — o yüzden burada da aynı desen (RPC + manuel yetki
-- kontrolü) tercih edildi. Bir revizyon silindiğinde, o teklifin (offers)
-- başka revizyonu kalmadıysa boş kabuk olarak kalmasın diye offers satırı
-- da birlikte silinir.
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

  if not (private.current_role() = 'pv_admin' or v_created_by = auth.uid()) then
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

grant execute on function public.delete_offer_version(uuid) to authenticated;
