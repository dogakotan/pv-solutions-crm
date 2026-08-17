-- create_lead her yeni nitelendirme alanında imza değiştirmek zorunda
-- kalıyordu (21 pozisyonel parametre, iki kez drop+recreate edildi).
-- Zorunlu 5 alan pozisyonel kalır, geri kalan tüm opsiyonel nitelendirme
-- alanları tek bir jsonb parametreye taşınır — yeni bir alan eklemek
-- artık signature değişikliği/drop function gerektirmez.
drop function if exists public.create_lead(
  text, text, text, text, text, uuid, text, text, text, text,
  text, numeric, numeric, text, text, text, text, text, text, text, text
);

create or replace function public.create_lead(
  p_customer_type text,
  p_customer_name text,
  p_phone text,
  p_city text,
  p_source text,
  p_idempotency_key uuid default null,
  p_qualification jsonb default '{}'::jsonb
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
    p_qualification->>'district', p_qualification->>'address',
    p_qualification->>'alternate_phone', p_qualification->>'email',
    p_qualification->>'building_type',
    (p_qualification->>'roof_area_m2')::numeric,
    (p_qualification->>'estimated_capacity_kwp')::numeric,
    p_qualification->>'pool_interest', p_qualification->>'heat_pump_interest',
    p_qualification->>'ev_interest', p_qualification->>'battery_interest',
    p_qualification->>'competitor_offer_status', p_qualification->>'competitor_offer_note',
    p_qualification->>'general_notes', p_qualification->>'lead_score',
    auth.uid(), auth.uid(), auth.uid()
  )
  returning * into v_lead;

  return v_lead;
end;
$$;

revoke execute on function public.create_lead(text, text, text, text, text, uuid, jsonb) from public;
revoke execute on function public.create_lead(text, text, text, text, text, uuid, jsonb) from anon;
grant execute on function public.create_lead(text, text, text, text, text, uuid, jsonb) to authenticated;
