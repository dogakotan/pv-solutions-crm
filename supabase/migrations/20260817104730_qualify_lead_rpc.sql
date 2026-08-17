-- qualifyLead app katmanında önce SELECT (mevcut stage'i öğrenmek ve
-- "Lead bulunamadı" kontrolü için) sonra UPDATE yapıyordu — iki ayrı
-- network round trip. lead_score ve nitelendirme kolonları korumalı
-- kolon değil ve leads_update_pv RLS'i zaten first_call/pv_sales/pv_admin
-- için doğru izinleri veriyor, bu yüzden SECURITY DEFINER ile yetki
-- mantığını burada tekrar etmeye gerek yok: fonksiyon SECURITY INVOKER
-- (varsayılan) kalıyor, tek UPDATE ... RETURNING ile hem RLS uygulanıyor
-- hem de stage geçişi (new -> contacted) aynı sorguda CASE ile yapılıyor.
create or replace function public.qualify_lead(
  p_lead_id uuid,
  p_lead_score text default null,
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
  p_general_notes text default null
)
returns public.leads
language plpgsql
set search_path = public
as $$
declare
  v_lead public.leads;
begin
  update public.leads
  set
    lead_score = p_lead_score,
    district = p_district,
    address = p_address,
    alternate_phone = p_alternate_phone,
    email = p_email,
    building_type = p_building_type,
    roof_area_m2 = p_roof_area_m2,
    estimated_capacity_kwp = p_estimated_capacity_kwp,
    pool_interest = p_pool_interest,
    heat_pump_interest = p_heat_pump_interest,
    ev_interest = p_ev_interest,
    battery_interest = p_battery_interest,
    competitor_offer_status = p_competitor_offer_status,
    competitor_offer_note = p_competitor_offer_note,
    general_notes = p_general_notes,
    stage = case when stage = 'new' then 'contacted' else stage end
  where id = p_lead_id
  returning * into v_lead;

  if not found then
    raise exception 'Lead bulunamadı';
  end if;

  return v_lead;
end;
$$;

revoke execute on function public.qualify_lead(
  uuid, text, text, text, text, text, text, numeric, numeric,
  text, text, text, text, text, text, text
) from public;
revoke execute on function public.qualify_lead(
  uuid, text, text, text, text, text, text, numeric, numeric,
  text, text, text, text, text, text, text
) from anon;
grant execute on function public.qualify_lead(
  uuid, text, text, text, text, text, text, numeric, numeric,
  text, text, text, text, text, text, text
) to authenticated;
