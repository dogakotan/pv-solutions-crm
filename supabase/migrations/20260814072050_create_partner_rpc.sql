-- Partner + hizmet bölgeleri + yetkinlikler + iç not artık tek
-- SECURITY DEFINER RPC ile atomik yazılıyor. Önceki durumda
-- partners/new/actions.ts bunu 4 tabloya sıralı insert ile
-- (transaction'sız) yapıyordu; ara adımlardan biri başarısız olursa
-- yarım kalmış bir partner kaydı ortada kalıyordu.

create or replace function public.create_partner(
  p_name text,
  p_city text,
  p_partner_code text default null,
  p_phone text default null,
  p_tax_number text default null,
  p_tax_office text default null,
  p_email text default null,
  p_address text default null,
  p_status text default 'candidate',
  p_pv_owner_id uuid default null,
  p_internal_notes text default null,
  p_service_regions text[] default '{}',
  p_capability_codes text[] default '{}'
)
returns public.partners
language plpgsql
security definer
set search_path = public
as $$
declare
  v_partner public.partners;
begin
  if private.current_role() is distinct from 'pv_admin' then
    raise exception 'Partner oluşturma yetkisi yalnızca pv_admin''e aittir';
  end if;

  insert into public.partners (
    name, partner_code, phone, tax_number, tax_office, email, city, address, status, pv_owner_id, created_by
  ) values (
    p_name, p_partner_code, p_phone, p_tax_number, p_tax_office, p_email, p_city, p_address,
    coalesce(p_status, 'candidate'), p_pv_owner_id, auth.uid()
  )
  returning * into v_partner;

  if p_internal_notes is not null and trim(p_internal_notes) <> '' then
    insert into public.partner_internal_notes (partner_id, note, updated_by)
    values (v_partner.id, p_internal_notes, auth.uid());
  end if;

  if array_length(p_service_regions, 1) > 0 then
    insert into public.partner_service_regions (partner_id, region_code)
    select v_partner.id, r from unnest(p_service_regions) as r;
  end if;

  if array_length(p_capability_codes, 1) > 0 then
    insert into public.partner_capabilities (partner_id, capability_code)
    select v_partner.id, c from unnest(p_capability_codes) as c;
  end if;

  perform private.write_audit_log(
    'create_partner', 'partners', v_partner.id,
    null, jsonb_build_object('name', p_name, 'status', v_partner.status), null
  );

  return v_partner;
end;
$$;

revoke execute on function public.create_partner(text, text, text, text, text, text, text, text, text, uuid, text, text[], text[]) from public;
grant execute on function public.create_partner(text, text, text, text, text, text, text, text, text, uuid, text, text[], text[]) to authenticated;
