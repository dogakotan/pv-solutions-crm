-- Yeni lead oluştururken telefon numarasına göre olası tekrarları göstermek
-- için. leads_select_pv RLS'i first_call'ı yalnızca kendi leadleriyle
-- sınırladığından, aynı telefonla önce başka biri tarafından girilmiş bir
-- lead normal SELECT ile görünmez — bu yüzden SECURITY DEFINER ile RLS
-- kapsamından bağımsız, yalnızca duplicate-tespiti için gerekli minimum
-- alanları (lead_no/customer_name/stage) döndüren dar bir fonksiyon.
create or replace function public.find_duplicate_leads_by_phone(p_phone text)
returns table (id uuid, lead_no text, customer_name text, stage text, created_at timestamptz)
language sql
security definer
set search_path to 'public'
stable
as $$
  select id, lead_no, customer_name, stage, created_at
  from public.leads
  where deleted_at is null
    and (phone = p_phone or alternate_phone = p_phone)
  order by created_at desc
  limit 5;
$$;

grant execute on function public.find_duplicate_leads_by_phone(text) to authenticated;
