-- Altıncı tur inceleme, migration senkron boşluğu: bu migration daha önce
-- yalnızca uzak (remote) veritabanına apply_migration ile uygulanmış,
-- repo'ya hiç commit edilmemişti — sıfırdan bir ortamda (supabase db reset,
-- yeni bir clone) bu iki RPC hiç var olmayacaktı. İçerik, canlı veritabanından
-- pg_get_functiondef ile birebir geri alınmıştır; davranışta hiçbir değişiklik
-- yok, yalnızca dosya artık mevcut.
--
-- assignManyToSales/assignManyToPartner, N lead için N ayrı tekil-lead RPC
-- çağrısı yapıyordu (Promise.all) — kısmi başarısızlıkta zaten uygulanmış
-- atamalar geri alınmıyordu. Bu iki batch RPC, mevcut tekil-lead mantığını
-- (assign_lead_to_sales/assign_lead_to_partner) hiç değiştirmeden bir
-- döngüde çağırıyor — herhangi bir lead'de hata olursa, o ana kadar
-- başarıyla atanmış lead'ler dahil tüm etkiler transaction rollback ile
-- hepsi-ya-da-hiçbiri şeklinde geri alınıyor.
create or replace function public.assign_leads_to_sales_batch(p_lead_ids uuid[], p_sales_user_id uuid)
returns setof public.leads
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_lead_id uuid;
begin
  foreach v_lead_id in array p_lead_ids loop
    return next public.assign_lead_to_sales(v_lead_id, p_sales_user_id);
  end loop;
  return;
end;
$function$;

create or replace function public.assign_leads_to_partner_batch(
  p_lead_ids uuid[],
  p_partner_id uuid,
  p_employee_id uuid default null,
  p_response_due_at timestamptz default null,
  p_share_note text default null
)
returns setof public.partner_referrals
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_lead_id uuid;
begin
  foreach v_lead_id in array p_lead_ids loop
    return next public.assign_lead_to_partner(v_lead_id, p_partner_id, p_employee_id, p_response_due_at, p_share_note);
  end loop;
  return;
end;
$function$;

revoke execute on function public.assign_leads_to_sales_batch(uuid[], uuid) from anon;
revoke execute on function public.assign_leads_to_partner_batch(uuid[], uuid, uuid, timestamptz, text) from anon;
