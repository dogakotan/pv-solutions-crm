-- Yeni Lead formu artık ilk kayıtta nitelendirme verilerini de alıyor
-- (leads/[id] sayfasındaki "Görüşme Sonucu" formuyla aynı alan seti —
-- first_call kullanıcısı görüşmeyi yaparken tüm bilgileri tek seferde
-- girebilsin istendi). Parametre sayısı değiştiği için imza değişiyor;
-- provision_partner_employee_phone_optional'daki gibi önce eski imzalı
-- fonksiyon drop edilip yeni parametrelerle (hepsi opsiyonel/default null)
-- yeniden oluşturuluyor. Kolonlardaki mevcut CHECK kısıtları (lead_score,
-- *_interest, competitor_offer_status) geçersiz değerleri zaten reddediyor.
drop function if exists public.create_lead(text, text, text, text, text, uuid);

create or replace function public.create_lead(
  p_customer_type text,
  p_customer_name text,
  p_phone text,
  p_city text,
  p_source text,
  p_idempotency_key uuid default null,
  p_district text default null,
  p_address text default null,
  p_alternate_phone text default null,
  p_email text default null,
  p_building_type text default null,
  p_roof_area_m2 numeric default null,
  p_estimated_capacity_kwp numeric default null,
  p_pool_interest text default null,
  p_heat_pump_interest text default null,
  p_ev_interest text default null,
  p_battery_interest text default null,
  p_competitor_offer_status text default null,
  p_competitor_offer_note text default null,
  p_general_notes text default null,
  p_lead_score text default null
)
returns public.leads
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_role public.app_role := private.current_role();
  v_lead public.leads;
begin
  if not coalesce(
    v_caller_role in ('pv_admin', 'pv_sales', 'first_call'),
    false
  ) then
    raise exception 'Lead oluşturma yetkiniz yok';
  end if;

  if p_idempotency_key is not null then
    insert into public.idempotency_keys (key) values (p_idempotency_key);
  end if;

  insert into public.leads (
    customer_type, customer_name, phone, city, source,
    district, address, alternate_phone, email,
    building_type, roof_area_m2, estimated_capacity_kwp,
    pool_interest, heat_pump_interest, ev_interest, battery_interest,
    competitor_offer_status, competitor_offer_note, general_notes, lead_score,
    owner_id, created_by, first_call_user_id
  ) values (
    p_customer_type, p_customer_name, p_phone, p_city, p_source,
    p_district, p_address, p_alternate_phone, p_email,
    p_building_type, p_roof_area_m2, p_estimated_capacity_kwp,
    p_pool_interest, p_heat_pump_interest, p_ev_interest, p_battery_interest,
    p_competitor_offer_status, p_competitor_offer_note, p_general_notes, p_lead_score,
    auth.uid(), auth.uid(), auth.uid()
  )
  returning * into v_lead;

  return v_lead;
end;
$$;

revoke execute on function public.create_lead(
  text, text, text, text, text, uuid, text, text, text, text,
  text, numeric, numeric, text, text, text, text, text, text, text, text
) from public;
revoke execute on function public.create_lead(
  text, text, text, text, text, uuid, text, text, text, text,
  text, numeric, numeric, text, text, text, text, text, text, text, text
) from anon;
grant execute on function public.create_lead(
  text, text, text, text, text, uuid, text, text, text, text,
  text, numeric, numeric, text, text, text, text, text, text, text, text
) to authenticated;
