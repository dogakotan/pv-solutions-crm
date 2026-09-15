-- Yol haritası 2.1 bulgusu tam kapatılmamıştı: claim_lead/create_lead/
-- create_lead_from_webhook/qualify_lead ve advance_lead_stage denetim
-- kaydı almaya başladı (add_missing_lead_audit_logs migration'ı) ama
-- bulguda ayrıca "özellikle önemli" diye işaretlenen delete_offer_version
-- (yıkıcı, daha önce ayrı bir güvenlik yamasına konu olmuş RPC) unutulmuş —
-- doğrulama sırasında pg_proc.prosrc üzerinden canlıda hâlâ write_audit_log
-- çağırmadığı teyit edildi.
create or replace function public.delete_offer_version(p_offer_version_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
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

  perform private.write_audit_log(
    'delete_offer_version', 'offer_versions', p_offer_version_id,
    jsonb_build_object('offer_id', v_offer_id, 'status', v_status),
    null,
    null
  );

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
