-- Dokuzuncu tur inceleme, yüksek bulgu: internal_notes 20260810070516'da
-- ayrı bir PV-only tabloya taşınmıştı ama general_notes (aynı ölçüde
-- hassas — first_call/pv_sales'in girdiği serbest metin notlar) bilerek
-- leads tablosunda bırakılmıştı (bkz. 20260805104259'un tablo yorumu).
-- Postgres'te kolon seviyesi RLS yok; leads_select'in partner dalı satır
-- seviyesinde doğru filtreleniyor olsa da, tablo genelinde SELECT granted
-- olduğundan bir partner_admin/employee, Next.js UI'ı hiç atlayıp doğrudan
-- PostgREST'e "select=general_notes,phone,..." isteği atarak bu sütunu
-- (ve leads'in diğer tüm sütunlarını) okuyabiliyordu. internal_notes'la
-- birebir aynı görünürlük kuralına (pv_admin / sahip pv_sales / sahip
-- first_call) sahip yeni bir tabloya taşınıyor.
create table public.lead_general_notes (
  lead_id uuid primary key references public.leads(id) on delete cascade,
  note text,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);

alter table public.lead_general_notes enable row level security;
revoke all on public.lead_general_notes from anon;

create policy lead_general_notes_select on public.lead_general_notes
  for select using (
    exists (
      select 1 from public.leads l
      where l.id = lead_general_notes.lead_id
        and (
          (select private.current_role()) = 'pv_admin'
          or (
            l.deleted_at is null and (
              ((select private.current_role()) = 'pv_sales' and (l.owner_id = (select auth.uid()) or l.sales_user_id = (select auth.uid())))
              or ((select private.current_role()) = 'first_call' and (l.created_by = (select auth.uid()) or l.first_call_user_id = (select auth.uid())))
            )
          )
        )
    )
  );

create policy lead_general_notes_insert on public.lead_general_notes
  for insert with check (
    exists (
      select 1 from public.leads l
      where l.id = lead_general_notes.lead_id
        and (
          (select private.current_role()) = 'pv_admin'
          or (
            l.deleted_at is null and (
              ((select private.current_role()) = 'pv_sales' and (l.owner_id = (select auth.uid()) or l.sales_user_id = (select auth.uid())))
              or ((select private.current_role()) = 'first_call' and (l.created_by = (select auth.uid()) or l.first_call_user_id = (select auth.uid())))
            )
          )
        )
    )
  );

create policy lead_general_notes_update on public.lead_general_notes
  for update
  using (
    exists (
      select 1 from public.leads l
      where l.id = lead_general_notes.lead_id
        and (
          (select private.current_role()) = 'pv_admin'
          or (
            l.deleted_at is null and (
              ((select private.current_role()) = 'pv_sales' and (l.owner_id = (select auth.uid()) or l.sales_user_id = (select auth.uid())))
              or ((select private.current_role()) = 'first_call' and (l.created_by = (select auth.uid()) or l.first_call_user_id = (select auth.uid())))
            )
          )
        )
    )
  )
  with check (
    exists (
      select 1 from public.leads l
      where l.id = lead_general_notes.lead_id
        and (
          (select private.current_role()) = 'pv_admin'
          or (
            l.deleted_at is null and (
              ((select private.current_role()) = 'pv_sales' and (l.owner_id = (select auth.uid()) or l.sales_user_id = (select auth.uid())))
              or ((select private.current_role()) = 'first_call' and (l.created_by = (select auth.uid()) or l.first_call_user_id = (select auth.uid())))
            )
          )
        )
    )
  );

insert into public.lead_general_notes (lead_id, note)
select id, general_notes from public.leads where general_notes is not null;

alter table public.leads drop column general_notes;

-- create_lead: general_notes artık leads insert'ine değil, ayrı tabloya yazılıyor.
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
    competitor_offer_status, competitor_offer_note, lead_score,
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
    p_qualification->>'lead_score',
    auth.uid(), auth.uid(), auth.uid()
  )
  returning * into v_lead;

  if p_qualification->>'general_notes' is not null then
    insert into public.lead_general_notes (lead_id, note, updated_by)
    values (v_lead.id, p_qualification->>'general_notes', auth.uid());
  end if;

  perform private.write_audit_log(
    'create_lead', 'leads', v_lead.id,
    null,
    jsonb_build_object('customer_name', p_customer_name, 'source', p_source),
    null
  );

  return v_lead;
end;
$function$;

-- qualify_lead: general_notes artık leads update'ine değil, ayrı tabloya
-- upsert ediliyor. Yetki kontrolü RPC'nin kendisinde zaten var (leads
-- UPDATE'inin WHERE'i) — ayrı tabloya yazarken de aynı kontrolü tekrar
-- SECURITY DEFINER bağlamında (RLS'i bypass ederek) yapıyoruz, çünkü
-- yetki zaten yukarıda doğrulandı.
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

  insert into public.lead_general_notes (lead_id, note, updated_by)
  values (p_lead_id, p_general_notes, auth.uid())
  on conflict (lead_id) do update set note = excluded.note, updated_at = now(), updated_by = excluded.updated_by;

  perform private.write_audit_log(
    'qualify_lead', 'leads', p_lead_id,
    null,
    jsonb_build_object('lead_score', v_lead.lead_score, 'stage', v_lead.stage),
    null
  );

  return v_lead;
end;
$function$;
