-- Onbirinci tur inceleme, yüksek bulgu: referral_visible_to_partner ve
-- lead_visible_via_partner_referral, ilişkili referral'ın kendi durumuna
-- hiç bakmıyordu — bir partnerin yönlendirmesi reddedilse/iptal edilse/
-- süresi dolsa bile o partner, lead'in canlı aşama geçmişini (ve daha
-- sonra BAŞKA bir partnere yönlendirilip kazanılmasını) süresiz izlemeye
-- devam ediyordu. Yalnızca "durum" statüsü ('rejected'/'cancelled'/
-- 'expired') hariç tutuluyor — 'completed' (kazanan partner) veya
-- 'pending'/'accepted' (hâlâ aktif) durumundaki referral'lar görünür
-- kalmaya devam ediyor; aksi halde kazanan partnerin satış sonrası
-- (örn. keşif ziyareti/teslimat) görünürlüğü de kırılırdı.
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
      and pr.status not in ('rejected', 'cancelled', 'expired')
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
      and pr.status not in ('rejected', 'cancelled', 'expired')
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
