-- add_missing_lead_audit_logs migration'ı qualify_lead/advance_lead_stage'e
-- write_audit_log çağrısı ekledi ama ikisi de SECURITY INVOKER'dı.
-- private.write_audit_log yalnızca service_role/postgres'e EXECUTE izinli
-- (bilinçli olarak — bkz. supabase_new_rpc_anon_grant_checklist) —
-- SECURITY DEFINER olmayan bir fonksiyondan çağrıldığında gerçek
-- authenticated kullanıcı için "permission denied for function
-- write_audit_log" hatası verir (SQL testiyle doğrulandı). Her ikisini de
-- SECURITY DEFINER'a çevirip RLS'in (leads_update_pv) yaptığı yetki
-- kontrolünü açıkça UPDATE'in WHERE'ine/başına taşıyoruz — round trip
-- sayısı artmıyor, sadece kontrol RLS'ten fonksiyon gövdesine taşınıyor.
create or replace function public.qualify_lead(
  p_lead_id uuid,
  p_lead_score text default null::text,
  p_district text default null::text,
  p_address text default null::text,
  p_alternate_phone text default null::text,
  p_email text default null::text,
  p_building_type text default null::text,
  p_roof_area_m2 numeric default null::numeric,
  p_estimated_capacity_kwp numeric default null::numeric,
  p_pool_interest text default null::text,
  p_heat_pump_interest text default null::text,
  p_ev_interest text default null::text,
  p_battery_interest text default null::text,
  p_competitor_offer_status text default null::text,
  p_competitor_offer_note text default null::text,
  p_general_notes text default null::text
)
returns leads
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_caller_role public.app_role := private.current_role();
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
    and deleted_at is null
    and (
      v_caller_role = 'pv_admin'
      or (v_caller_role = 'pv_sales' and (owner_id = auth.uid() or sales_user_id = auth.uid()))
      or (v_caller_role = 'first_call' and (created_by = auth.uid() or first_call_user_id = auth.uid()))
    )
  returning * into v_lead;

  if not found then
    raise exception 'Lead bulunamadı';
  end if;

  perform private.write_audit_log(
    'qualify_lead', 'leads', p_lead_id,
    null,
    jsonb_build_object('lead_score', v_lead.lead_score, 'stage', v_lead.stage),
    null
  );

  return v_lead;
end;
$function$;

create or replace function public.advance_lead_stage(p_lead_id uuid, p_next_stage text)
returns leads
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_caller_role public.app_role := private.current_role();
  v_old_lead public.leads;
  v_lead public.leads;
begin
  select * into v_old_lead from public.leads where id = p_lead_id and deleted_at is null;
  if v_old_lead is null then
    raise exception 'Lead bulunamadı';
  end if;

  if not coalesce(
    v_caller_role = 'pv_admin'
    or (v_caller_role = 'pv_sales' and (v_old_lead.owner_id = auth.uid() or v_old_lead.sales_user_id = auth.uid())),
    false
  ) then
    raise exception 'Bu lead için aşama ilerletme yetkiniz yok';
  end if;

  update public.leads
  set stage = p_next_stage
  where id = p_lead_id
  returning * into v_lead;

  perform private.write_audit_log(
    'advance_lead_stage', 'leads', p_lead_id,
    jsonb_build_object('stage', v_old_lead.stage),
    jsonb_build_object('stage', v_lead.stage),
    null
  );

  return v_lead;
end;
$function$;
