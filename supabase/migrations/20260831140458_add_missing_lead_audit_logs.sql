-- claim_lead, create_lead, create_lead_from_webhook, qualify_lead hiçbiri
-- write_audit_log çağırmıyordu — diğer tüm ayrıcalıklı lead mutasyonları
-- (assign_lead_to_sales, assign_lead_to_partner, soft_delete_lead,
-- record_sales_outcome) çağırırken bu dördü denetim izi bırakmıyordu.

create or replace function public.claim_lead(p_lead_id uuid)
returns leads
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_caller_role public.app_role := private.current_role();
  v_lead public.leads;
begin
  if v_caller_role not in ('first_call', 'pv_admin') then
    raise exception 'Bu işlemi yapma yetkiniz yok';
  end if;

  perform set_config('app.bypass_lead_protection', 'on', true);

  update public.leads
  set first_call_user_id = auth.uid()
  where id = p_lead_id
    and deleted_at is null
    and first_call_user_id is null
  returning * into v_lead;

  if not found then
    raise exception 'Lead bulunamadı veya zaten sahiplenilmiş';
  end if;

  perform private.write_audit_log(
    'claim_lead', 'leads', p_lead_id,
    jsonb_build_object('first_call_user_id', null),
    jsonb_build_object('first_call_user_id', auth.uid()),
    null
  );

  return v_lead;
end;
$function$;

create or replace function public.create_lead(
  p_customer_type text,
  p_customer_name text,
  p_phone text,
  p_city text,
  p_source text,
  p_idempotency_key uuid default null::uuid,
  p_qualification jsonb default '{}'::jsonb
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

  perform private.write_audit_log(
    'create_lead', 'leads', v_lead.id,
    null,
    jsonb_build_object('customer_name', p_customer_name, 'source', p_source),
    null
  );

  return v_lead;
end;
$function$;

create or replace function public.create_lead_from_webhook(
  p_customer_name text,
  p_phone text,
  p_city text,
  p_source text,
  p_external_ref text default null::text
)
returns leads
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_system_user_id uuid;
  v_lead public.leads;
begin
  if p_external_ref is not null then
    select * into v_lead from public.leads where external_ref = p_external_ref;
    if found then
      return v_lead;
    end if;
  end if;

  select id into v_system_user_id
  from public.profiles
  where email = 'system-integrations@pvsolutionstr.com';

  if v_system_user_id is null then
    raise exception 'Sistem entegrasyon profili bulunamadı (system-integrations@pvsolutionstr.com)';
  end if;

  insert into public.leads (
    customer_type, customer_name, phone, city, source, external_ref,
    owner_id, created_by, first_call_user_id
  ) values (
    'individual', p_customer_name, p_phone, coalesce(nullif(trim(p_city), ''), 'Bilinmiyor'), p_source, p_external_ref,
    v_system_user_id, v_system_user_id, null
  )
  returning * into v_lead;

  perform private.write_audit_log(
    'create_lead_from_webhook', 'leads', v_lead.id,
    null,
    jsonb_build_object('customer_name', p_customer_name, 'source', p_source, 'external_ref', p_external_ref),
    null
  );

  return v_lead;
end;
$function$;

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
set search_path to 'public'
as $function$
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

  perform private.write_audit_log(
    'qualify_lead', 'leads', p_lead_id,
    null,
    jsonb_build_object('lead_score', v_lead.lead_score, 'stage', v_lead.stage),
    null
  );

  return v_lead;
end;
$function$;

-- advanceLeadStage Server Action'ı (src/app/(protected)/leads/[id]/actions.ts)
-- RPC katmanını tamamen atlayıp doğrudan .update() yapıyordu — tek ayrıcalıklı
-- lead mutasyonuydu ki hem RPC değildi hem denetim kaydı bırakmıyordu. Geçerli
-- sıradaki-aşama tablosu (NEXT_STAGE) kasıtlı olarak yalnızca TypeScript'te
-- tutuluyor (bkz. src/types/lead.ts yorumu) — bu RPC onu tekrar etmiyor,
-- sadece action'ın önceden hesapladığı hedef aşamayı update + audit log ile
-- sarmalıyor. SECURITY INVOKER: leads_update_pv RLS zaten kimin
-- güncelleyebileceğini belirliyor, stage protected_columns'ta değil.
create or replace function public.advance_lead_stage(p_lead_id uuid, p_next_stage text)
returns leads
language plpgsql
set search_path to 'public'
as $function$
declare
  v_old_lead public.leads;
  v_lead public.leads;
begin
  select * into v_old_lead from public.leads where id = p_lead_id and deleted_at is null;
  if v_old_lead is null then
    raise exception 'Lead bulunamadı';
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

revoke execute on function public.advance_lead_stage(uuid, text) from public;
revoke execute on function public.advance_lead_stage(uuid, text) from anon;
grant execute on function public.advance_lead_stage(uuid, text) to authenticated;
