-- Faz 11 güvenlik denetimi (Supabase advisor): Postgres yeni fonksiyonlara
-- varsayılan olarak PUBLIC'e EXECUTE veriyor. find_duplicate_leads_by_phone
-- ve record_sales_outcome (Faz 8) oluşturulurken bu varsayılan hiç revoke
-- edilmemiş — ikisi de anon (oturumsuz) tarafından çağrılabiliyordu.
--
-- find_duplicate_leads_by_phone içinde HİÇBİR auth kontrolü yoktu (RLS'i
-- kasıtlı bypass eden dar bir SECURITY DEFINER fonksiyonu olduğu için) —
-- bu, internetten oturum açmadan herhangi bir telefon numarasıyla
-- lead_no/müşteri adı sorgulanabilmesi anlamına geliyordu. Gerçek bir veri
-- sızıntısıydı, sadece GRANT eksikliği değil.
--
-- record_sales_outcome zaten coalesce-safe bir pv_admin/pv_sales kontrolü
-- içeriyordu (Faz 5'teki NULL-propagation düzeltmesi sayesinde anon çağrısı
-- zaten reddediliyordu) ama GRANT seviyesinde de kapatmak proje genelindeki
-- "her tabloda anon'dan revoke all" kuralıyla tutarlı olsun diye yapıldı.
revoke execute on function public.find_duplicate_leads_by_phone(text) from public;
revoke execute on function public.record_sales_outcome(uuid, text, uuid, numeric, text, text, text, date, text) from public;

grant execute on function public.find_duplicate_leads_by_phone(text) to authenticated;
grant execute on function public.record_sales_outcome(uuid, text, uuid, numeric, text, text, text, date, text) to authenticated;

-- Savunma derinliği: find_duplicate_leads_by_phone kendi içinde de
-- oturumsuz çağrıyı reddetsin, yalnızca GRANT'e güvenmesin.
create or replace function public.find_duplicate_leads_by_phone(p_phone text)
returns table (id uuid, lead_no text, customer_name text, stage text, created_at timestamptz)
language sql
security definer
set search_path to 'public'
stable
as $$
  select id, lead_no, customer_name, stage, created_at
  from public.leads
  where auth.uid() is not null
    and deleted_at is null
    and (phone = p_phone or alternate_phone = p_phone)
  order by created_at desc
  limit 5;
$$;

grant execute on function public.find_duplicate_leads_by_phone(text) to authenticated;
