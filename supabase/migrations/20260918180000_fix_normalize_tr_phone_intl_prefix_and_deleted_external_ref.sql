-- Dokuzuncu tur inceleme, düşük öncelik (2 madde):
--
-- 1) normalize_tr_phone, uluslararası arama öneki "00" ile gelen numaraları
--    ("0090XXXXXXXXXX", 14 hane) tanımıyordu — hiçbir case'e uymadığından
--    "else digits" dalına düşüp ham 14 haneli hâliyle döndürülüyor, aynı
--    numaranın "05XXXXXXXXX" biçimiyle asla eşleşmiyordu (yanlış-negatif
--    duplicate tespiti).
--
-- 2) create_lead_from_webhook'un external_ref kısa devresi deleted_at'i
--    yoksayıyordu — lead soft-silindikten sonra aynı external_ref ile
--    tekrar denenen bir webhook (örn. Meta/Google retry), silinmiş kaydı
--    sessizce "başarılı" olarak döndürüyordu; hiçbir pv çalışanı bu lead'i
--    havuzda göremediği için reklam platformu tarafında "işlendi" görünen
--    bir fırsat kayboluyordu. leads_external_ref_idx (yalnızca
--    external_ref is not null, deleted_at'ten bağımsız) nedeniyle bu
--    durumda basitçe yeni bir lead oluşturmak unique ihlaline çarpardı;
--    bunun yerine açık, aksiyon alınabilir bir hata fırlatılıyor —
--    webhook route'ları bunu zaten notify_admins_webhook_lead_failure'a
--    yönlendiriyor.
create or replace function private.normalize_tr_phone(p_phone text)
returns text
language sql
immutable
set search_path = pg_catalog, public
as $$
  select case
    when digits ~ '^0090\d{10}$' then '0' || substring(digits from 5)
    when digits ~ '^90\d{10}$' then '0' || substring(digits from 3)
    when digits ~ '^0\d{10}$' then digits
    when digits ~ '^\d{10}$' then '0' || digits
    when digits = '' then null
    else digits
  end
  from (select regexp_replace(coalesce(p_phone, ''), '\D', '', 'g') as digits) s;
$$;

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
      if v_lead.deleted_at is not null then
        raise exception 'Bu referansla (external_ref: %) daha önce oluşturulan lead silinmiş — webhook tekrar denemesi otomatik olarak geri getirilmiyor', p_external_ref;
      end if;
      return v_lead;
    end if;
  end if;

  if nullif(trim(coalesce(p_phone, '')), '') is null then
    raise exception 'Telefon numarası boş — lead oluşturulamadı';
  end if;

  v_normalized_phone := private.normalize_tr_phone(p_phone);

  if v_normalized_phone is null then
    raise exception 'Telefon numarası geçersiz — lead oluşturulamadı';
  end if;

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
