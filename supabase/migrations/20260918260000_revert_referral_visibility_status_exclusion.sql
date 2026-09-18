-- 20260918230000'in geri alınması: rejected/cancelled/expired durumundaki
-- referral'ları görünürlükten hariç tutmak, e2e ile doğrulanmış gerçek bir
-- kullanıcı akışını bozdu — partner KENDİ yönlendirmesini reddettiğinde
-- (respond_to_referral), reddettiği referral'ın/lead'in "Reddedildi"
-- onayını görmeye devam etmesi gerekiyor (lead-actions.spec.ts:178'in
-- kanıtladığı gibi, reddetme işleminin hemen ardından aynı sayfada). Asıl
-- endişe (bir partnerin, kendisi dışındaki bir partnerin BAŞKA bir döngüde
-- kazandığı sonucu süresiz izlemesi) bu blanket exclude ile güvenli şekilde
-- ayrıştırılamadı — deleted_at kontrolü korunuyor, durum bazlı hariç tutma
-- kaldırılıyor.
create or replace function private.referral_visible_to_partner(p_referral_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.partner_referrals pr
    join public.leads l on l.id = pr.lead_id
    where pr.id = p_referral_id
      and l.deleted_at is null
      and (
        ((select private.current_role()) = 'partner_admin' and pr.partner_id = (select private.current_partner_id()))
        or (
          (select private.current_role()) = 'partner_employee'
          and pr.partner_id = (select private.current_partner_id())
          and pr.assigned_employee_id = (select auth.uid())
        )
      )
  );
$$;

create or replace function private.lead_visible_via_partner_referral(p_lead_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.partner_referrals pr
    join public.leads l on l.id = pr.lead_id
    where pr.lead_id = p_lead_id
      and l.deleted_at is null
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
