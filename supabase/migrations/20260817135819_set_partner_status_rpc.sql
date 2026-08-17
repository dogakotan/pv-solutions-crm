-- create_partner yalnızca oluşturma anında status belirleyebiliyordu
-- (p_status default 'candidate'); sonrasında bir partner'ı Aday'dan
-- Aktif'e (veya Aktif'ten Askıda'ya) taşıyacak hiçbir yol yoktu.
-- Admin şimdilik partneri doğrudan 'active' oluşturarak bunu aşabiliyor,
-- ama gerçek bir yaşam döngüsü boşluğu — assign_lead_to_partner de
-- yalnızca status='active' olan partnerlere izin veriyor.
create or replace function public.set_partner_status(
  p_partner_id uuid,
  p_status text
)
returns public.partners
language plpgsql
security definer
set search_path = public
as $$
declare
  v_partner public.partners;
  v_old_status text;
begin
  if private.current_role() is distinct from 'pv_admin' then
    raise exception 'Partner durumunu yalnızca admin değiştirebilir';
  end if;

  if p_status not in ('candidate', 'active', 'suspended', 'inactive') then
    raise exception 'Geçersiz durum: %', p_status;
  end if;

  select * into v_partner from public.partners where id = p_partner_id;
  if v_partner is null then
    raise exception 'Partner bulunamadı';
  end if;
  v_old_status := v_partner.status;

  update public.partners
  set status = p_status
  where id = p_partner_id
  returning * into v_partner;

  perform private.write_audit_log(
    'set_partner_status', 'partners', p_partner_id,
    jsonb_build_object('status', v_old_status),
    jsonb_build_object('status', p_status),
    null
  );

  return v_partner;
end;
$$;

revoke execute on function public.set_partner_status(uuid, text) from public;
revoke execute on function public.set_partner_status(uuid, text) from anon;
grant execute on function public.set_partner_status(uuid, text) to authenticated;
