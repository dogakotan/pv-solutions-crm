-- Faz 11 RLS matrisi taramasında bulundu: private.referral_lead_owned_by_me()
-- yalnızca leads.owner_id = auth.uid() kontrol ediyordu, çağıranın rolüne
-- hiç bakmıyordu. leads tablosunda first_call tarafından oluşturulan bir
-- lead'de owner_id = first_call kullanıcısıdır (first_call_user_id ayrı bir
-- kolon, owner_id'nin yerini almaz) — bu yüzden first_call, kendi
-- leadlerinde bu fonksiyonu kullanan partner_referrals_insert/select/update
-- politikalarında "yetkili" sayılıyordu. Gerçekte hem doküman (3.5 Rol-işlem
-- matrisi: "Yönlendirme oluşturma: Evet(admin)/Owner ise(sales)/Hayır/Hayır")
-- hem assign_lead_to_partner RPC'sinin kendi iç kontrolü ('pv_admin' veya
-- 'pv_sales' + owner/sales_user eşleşmesi) bunu yalnızca pv_sales'e ayırıyor.
--
-- Doğrulandı: first_call rolünde bir test kullanıcısı, RPC'yi tamamen atlayıp
-- (partner aktiflik kontrolü, çalışan-partner eşleşme kontrolü, bildirim,
-- audit log dahil) doğrudan partner_referrals'a REST insert ile bir
-- yönlendirme oluşturabiliyordu — test edilip rollback edildi.
create or replace function private.referral_lead_owned_by_me(p_lead_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from public.leads l
    where l.id = p_lead_id
      and private.current_role() = 'pv_sales'
      and (l.owner_id = auth.uid() or l.sales_user_id = auth.uid())
  );
$$;
