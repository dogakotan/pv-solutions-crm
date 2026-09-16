-- Dördüncü tur — create_lead_from_webhook, p_city için boş-string'i
-- 'Bilinmiyor'a çeviren bir coalesce/nullif taşıyordu ama p_phone için
-- aynı koruma yoktu. Reklam platformunun form alanı eksik/adı uyuşmazsa
-- webhook route'ları phone: fieldValue(...) ?? "" ile boş string
-- gönderiyor — leads.phone NOT NULL olduğu için bu sessizce başarılı
-- oluyor, first_call'ın hiç arayamayacağı bir lead kaydediliyor ve
-- notify_admins_webhook_lead_failure hiç tetiklenmiyordu (RPC hata
-- vermediği için). Artık boş telefonla açıkça hata veriyor — her iki
-- webhook route'u da (meta-leads, google-leads) RPC hatasında zaten
-- notify_admins_webhook_lead_failure'ı çağırıyor.
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

  if nullif(trim(coalesce(p_phone, '')), '') is null then
    raise exception 'Telefon numarası boş — lead oluşturulamadı';
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
