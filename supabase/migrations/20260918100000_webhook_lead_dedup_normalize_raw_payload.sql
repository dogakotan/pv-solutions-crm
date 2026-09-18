-- Roadmap'in son açık maddesi (küçük tutarlılık kümesi, kalan alt madde):
-- create_lead_from_webhook (1) telefon numaralarını normalize etmiyordu
-- (aynı numara "+905551234567" / "05551234567" / "5551234567" gibi farklı
-- biçimlerde gelip aynı kişi için ayrı lead'ler oluşturabiliyordu), (2)
-- telefon bazlı hiçbir duplicate kontrolü yapmıyordu (manuel oluşturmada
-- kullanılan find_duplicate_leads_by_phone'un webhook eşdeğeri yoktu), (3)
-- reklam platformundan gelen kampanya/form meta verisini (Meta'nın
-- ad_id/form_id/campaign_id, field_data; Google'ın user_column_data'sı)
-- hiç saklamıyordu.
--
-- Duplicate kuralı: yalnızca AÇIK (stage not in ('won','lost',
-- 'sale_registered') — kod tabanının zaten kullandığı "açık lead" tanımı)
-- ve silinmemiş bir lead aynı normalize telefonu paylaşıyorsa yeni lead
-- oluşturulmuyor, mevcut lead döndürülüp pv_admin'e bildirim düşülüyor.
-- Kapanmış bir lead'le aynı telefon, muhtemelen gerçekten yeni bir fırsat
-- olduğundan engellenmiyor.

alter table public.leads add column if not exists webhook_raw_payload jsonb;
comment on column public.leads.webhook_raw_payload is 'Webhook ile oluşturulan lead''ler için reklam platformunun ham payload''ı (kampanya/form/reklam meta verisi) — yalnızca kayıt/hata ayıklama amaçlı, uygulama tarafından okunmuyor.';

create or replace function private.normalize_tr_phone(p_phone text)
returns text
language sql
immutable
set search_path = pg_catalog, public
as $$
  select case
    when digits ~ '^90\d{10}$' then '0' || substring(digits from 3)
    when digits ~ '^0\d{10}$' then digits
    when digits ~ '^\d{10}$' then '0' || digits
    else digits
  end
  from (select regexp_replace(coalesce(p_phone, ''), '\D', '', 'g') as digits) s;
$$;

create or replace function private.notify_admins_webhook_lead_duplicate(
  p_source text,
  p_external_ref text,
  p_phone text,
  p_existing_lead_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (recipient_user_id, type, title, message, priority, dedup_key)
  select
    ura.user_id, 'webhook_lead_duplicate', 'Webhook lead tekrarı algılandı',
    p_source || ' üzerinden gelen bir lead (ref: ' || coalesce(p_external_ref, 'bilinmiyor') ||
      '), açık bir lead ile aynı telefon numarasını (' || p_phone || ') paylaştığı için ayrıca oluşturulmadı.',
    'normal',
    'webhook_lead_duplicate:' || p_source || ':' || coalesce(p_external_ref, gen_random_uuid()::text)
  from public.user_role_assignments ura
  join public.profiles pf on pf.id = ura.user_id
  where ura.role = 'pv_admin' and pf.is_active = true
  on conflict (dedup_key) do nothing;
end;
$$;

revoke execute on function private.notify_admins_webhook_lead_duplicate(text, text, text, uuid) from public;

drop function if exists public.create_lead_from_webhook(text, text, text, text, text);

create or replace function public.create_lead_from_webhook(
  p_customer_name text,
  p_phone text,
  p_city text,
  p_source text,
  p_external_ref text default null::text,
  p_raw_payload jsonb default null::jsonb
)
returns leads
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_system_user_id uuid;
  v_lead public.leads;
  v_normalized_phone text;
  v_existing_id uuid;
begin
  if p_external_ref is not null then
    select * into v_lead from public.leads where external_ref = p_external_ref;
    if found then
      return v_lead;
    end if;
  end if;

  if nullif(trim(coalesce(p_phone, '')), '') is null then
    raise exception 'Telefon numarası boş — lead oluşturulamadı';
  end if;

  v_normalized_phone := private.normalize_tr_phone(p_phone);

  select id into v_existing_id
  from public.leads
  where deleted_at is null
    and stage not in ('won', 'lost', 'sale_registered')
    and (private.normalize_tr_phone(phone) = v_normalized_phone
         or private.normalize_tr_phone(alternate_phone) = v_normalized_phone)
  order by created_at desc
  limit 1;

  if v_existing_id is not null then
    perform private.notify_admins_webhook_lead_duplicate(p_source, p_external_ref, v_normalized_phone, v_existing_id);
    select * into v_lead from public.leads where id = v_existing_id;
    return v_lead;
  end if;

  select id into v_system_user_id
  from public.profiles
  where email = 'system-integrations@pvsolutionstr.com';

  if v_system_user_id is null then
    raise exception 'Sistem entegrasyon profili bulunamadı (system-integrations@pvsolutionstr.com)';
  end if;

  insert into public.leads (
    customer_type, customer_name, phone, city, source, external_ref,
    owner_id, created_by, first_call_user_id, webhook_raw_payload
  ) values (
    'individual', p_customer_name, v_normalized_phone, coalesce(nullif(trim(p_city), ''), 'Bilinmiyor'), p_source, p_external_ref,
    v_system_user_id, v_system_user_id, null, p_raw_payload
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

revoke execute on function public.create_lead_from_webhook(text, text, text, text, text, jsonb) from public;
revoke execute on function public.create_lead_from_webhook(text, text, text, text, text, jsonb) from anon;
revoke execute on function public.create_lead_from_webhook(text, text, text, text, text, jsonb) from authenticated;
grant execute on function public.create_lead_from_webhook(text, text, text, text, text, jsonb) to service_role;
