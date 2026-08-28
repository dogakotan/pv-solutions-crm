-- Paylaşımlı havuzdaki (first_call_user_id null) bir leadi first_call
-- kullanıcısının sahiplenmesi. SECURITY DEFINER zorunlu: leads_update_pv
-- RLS'inin USING'i first_call'ı created_by=auth.uid() OR
-- first_call_user_id=auth.uid() ile sınırlıyor — unclaimed bir lead
-- (first_call_user_id null, created_by=sistem profili) hiçbir first_call
-- kullanıcısı için UPDATE hedefi olarak görünmez. UPDATE RLS'ine
-- dokunmuyoruz (o politika olduğu gibi kalıyor) — bunun yerine bu dar
-- kapsamlı RPC yalnızca first_call_user_id'yi NULL'dan auth.uid()'a
-- taşıyor; bu olduktan sonra mevcut UPDATE RLS'i (first_call_user_id =
-- auth.uid()) zaten doğal olarak çalışır, örn. qualify_lead artık
-- normal şekilde erişebilir.
create or replace function public.claim_lead(p_lead_id uuid)
returns public.leads
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_role public.app_role := private.current_role();
  v_lead public.leads;
begin
  if v_caller_role not in ('first_call', 'pv_admin') then
    raise exception 'Bu işlemi yapma yetkiniz yok';
  end if;

  update public.leads
  set first_call_user_id = auth.uid()
  where id = p_lead_id
    and deleted_at is null
    and first_call_user_id is null
  returning * into v_lead;

  if not found then
    raise exception 'Lead bulunamadı veya zaten sahiplenilmiş';
  end if;

  return v_lead;
end;
$$;

revoke execute on function public.claim_lead(uuid) from public;
revoke execute on function public.claim_lead(uuid) from anon;
grant execute on function public.claim_lead(uuid) to authenticated;
