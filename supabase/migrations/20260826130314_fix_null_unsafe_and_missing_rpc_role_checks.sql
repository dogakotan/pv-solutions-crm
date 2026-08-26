-- Güvenlik denetimi (SECURITY DEFINER advisor taraması) iki gerçek açık buldu:
--
-- 1) list_active_sales_users: `if v_caller_role not in ('pv_admin','first_call')`
--    NULL-unsafe. current_role() deaktif/henüz provizyon edilmemiş bir
--    authenticated kullanıcı için NULL döner; `NULL not in (...)` de NULL
--    olur, plpgsql'de `if NULL then` false sayılır ve exception atlanmadan
--    fonksiyon devam eder — tüm aktif pv_sales kullanıcılarının isim/id
--    listesi sızar. Projenin her yerde kullandığı coalesce/is-distinct-from
--    NULL-safe desenine çekiliyor.
create or replace function public.list_active_sales_users()
returns table(id uuid, full_name text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_role public.app_role := private.current_role();
begin
  if not coalesce(v_caller_role in ('pv_admin', 'first_call'), false) then
    raise exception 'Bu listeyi görüntüleme yetkiniz yok';
  end if;

  return query
  select p.id, p.full_name
  from public.profiles p
  join public.user_role_assignments ura on ura.user_id = p.id
  where p.is_active = true and ura.role = 'pv_sales'
  order by p.full_name;
end;
$$;

-- 2) find_duplicate_leads_by_phone: yalnızca `auth.uid() is not null` kontrol
--    ediyordu (rol kontrolü yoktu) — herhangi bir rolden (partner dahil) giriş
--    yapmış kullanıcı rastgele bir telefon numarasıyla sistemdeki HERHANGİ bir
--    lead'in müşteri adı/aşamasını sorgulayabiliyordu, kendi partnerine hiç
--    yönlendirilmemiş leadler dahil (çapraz-partner PII sızıntısı). create_lead
--    ile aynı izin listesine (pv_admin/pv_sales/first_call) kapatılıyor.
create or replace function public.find_duplicate_leads_by_phone(p_phone text)
returns table (id uuid, lead_no text, customer_name text, stage text, created_at timestamptz)
language sql
security definer
set search_path to 'public'
stable
as $$
  select id, lead_no, customer_name, stage, created_at
  from public.leads
  where coalesce((select private.current_role()) in ('pv_admin', 'pv_sales', 'first_call'), false)
    and deleted_at is null
    and (phone = p_phone or alternate_phone = p_phone)
  order by created_at desc
  limit 5;
$$;
