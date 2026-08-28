-- Reklam webhook'larının (örn. Meta Lead Ads) çağırdığı lead oluşturma
-- yolu. create_lead RPC'si kullanılamaz çünkü auth.uid() gerektiriyor —
-- webhook'un gerçek bir Supabase kullanıcı oturumu yok, service_role
-- anahtarıyla çalışıyor. Yalnızca service_role'e grant edilir (authenticated
-- dahil hiçbir normal kullanıcı bunu çağıramaz) — bu, auth.uid() atlayan
-- ve owner_id/created_by'yi sabit bir sistem profiline yazan bilinçli bir
-- yetki genişletmesi, sıradan kullanıcılara açılmamalı.
--
-- owner_id/created_by "system-integrations@pvsolutionstr.com" profiline
-- yazılır (admin "+ Yeni Kullanıcı" akışıyla first_call rolünde bir kez
-- oluşturuldu) — first_call_user_id NULL bırakılır, bu da leadi
-- paylaşımlı havuzda (leads_select RLS'teki "first_call_user_id is null"
-- koluyla) TÜM first_call kullanıcılarına görünür kılar, biri claim_lead
-- ile sahiplenene kadar.
--
-- p_external_ref (örn. Meta'nın leadgen_id'si) daha önce işlendiyse
-- (webhook retry) hata vermek yerine mevcut satırı döndürür — create_lead
-- RPC'sinin idempotency_key deseniyle aynı ruh.
create or replace function public.create_lead_from_webhook(
  p_customer_name text,
  p_phone text,
  p_city text,
  p_source text,
  p_external_ref text default null
)
returns public.leads
language plpgsql
security definer
set search_path = public
as $$
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

  return v_lead;
end;
$$;

revoke execute on function public.create_lead_from_webhook(text, text, text, text, text) from public;
revoke execute on function public.create_lead_from_webhook(text, text, text, text, text) from anon;
revoke execute on function public.create_lead_from_webhook(text, text, text, text, text) from authenticated;
grant execute on function public.create_lead_from_webhook(text, text, text, text, text) to service_role;
