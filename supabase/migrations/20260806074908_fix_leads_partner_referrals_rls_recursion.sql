-- =========================================================
-- KRİTİK DÜZELTME: leads_select_partner (leads üzerinde) ve
-- partner_referrals_select/insert/update (partner_referrals üzerinde)
-- birbirini karşılıklı EXISTS alt sorgusuyla çağırıyordu:
--   leads politikası -> partner_referrals'ı sorgular
--   partner_referrals politikası -> leads'i sorgular
-- Bu, Postgres'in RLS politika değerlendirmesinde "infinite recursion
-- detected in policy for relation" hatasına yol açıyor — leads
-- tablosuna yapılan HER select (rol fark etmeksizin) bu döngüye
-- giriyordu. Bu, önceki bir migration'dan (partner_referrals_core)
-- kalma, daha önce partner rolüyle hiç test edilmemiş bir hataydı.
--
-- Çözüm: çapraz tablo bakışlarını SECURITY DEFINER fonksiyonlara
-- taşıyoruz. current_role()/current_partner_id() gibi bu fonksiyonlar
-- da sorguladıkları tablonun RLS'ini bypass eder (fonksiyon sahibinin
-- yetkisiyle çalışır), bu yüzden döngü kırılır.
-- =========================================================

create or replace function private.lead_visible_via_partner_referral(p_lead_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.partner_referrals pr
    where pr.lead_id = p_lead_id
      and (
        (private.current_role() = 'partner_admin' and pr.partner_id = private.current_partner_id())
        or (
          private.current_role() = 'partner_employee'
          and pr.partner_id = private.current_partner_id()
          and pr.assigned_employee_id = auth.uid()
        )
      )
  );
$$;

revoke execute on function private.lead_visible_via_partner_referral(uuid) from public;
revoke execute on function private.lead_visible_via_partner_referral(uuid) from anon;
grant execute on function private.lead_visible_via_partner_referral(uuid) to authenticated;

create or replace function private.referral_lead_owned_by_me(p_lead_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.leads l where l.id = p_lead_id and l.owner_id = auth.uid()
  );
$$;

revoke execute on function private.referral_lead_owned_by_me(uuid) from public;
revoke execute on function private.referral_lead_owned_by_me(uuid) from anon;
grant execute on function private.referral_lead_owned_by_me(uuid) to authenticated;

-- leads_select_partner: partner_referrals'a artık doğrudan değil,
-- SECURITY DEFINER fonksiyon üzerinden bakıyor.
drop policy leads_select_partner on public.leads;

create policy leads_select_partner on public.leads
for select
using (
  deleted_at is null
  and private.lead_visible_via_partner_referral(id)
);

-- partner_referrals_select/insert/update: leads'e artık doğrudan
-- değil, SECURITY DEFINER fonksiyon üzerinden bakıyor.
drop policy partner_referrals_select on public.partner_referrals;
drop policy partner_referrals_insert on public.partner_referrals;
drop policy partner_referrals_update on public.partner_referrals;

create policy partner_referrals_select on public.partner_referrals
for select
using (
  (select private.current_role()) = 'pv_admin'
  or private.referral_lead_owned_by_me(lead_id)
  or ((select private.current_role()) = 'partner_admin' and partner_id = (select private.current_partner_id()))
  or (
    (select private.current_role()) = 'partner_employee'
    and partner_id = (select private.current_partner_id())
    and assigned_employee_id = (select auth.uid())
  )
);

create policy partner_referrals_insert on public.partner_referrals
for insert
with check (
  (select private.current_role()) = 'pv_admin'
  or private.referral_lead_owned_by_me(lead_id)
);

create policy partner_referrals_update on public.partner_referrals
for update
using (
  (select private.current_role()) = 'pv_admin'
  or private.referral_lead_owned_by_me(lead_id)
  or ((select private.current_role()) = 'partner_admin' and partner_id = (select private.current_partner_id()))
)
with check (
  (select private.current_role()) = 'pv_admin'
  or private.referral_lead_owned_by_me(lead_id)
  or ((select private.current_role()) = 'partner_admin' and partner_id = (select private.current_partner_id()))
);

-- lead_stage_history_select_partner: tutarlılık için aynı deseni
-- kullanacak şekilde güncellendi (döngü riski yoktu ama tekilleştirme
-- ve performans için).
drop policy lead_stage_history_select_partner on public.lead_stage_history;

create policy lead_stage_history_select_partner on public.lead_stage_history
for select
using (private.lead_visible_via_partner_referral(lead_id));
