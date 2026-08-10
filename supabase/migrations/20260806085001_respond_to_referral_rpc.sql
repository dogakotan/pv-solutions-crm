-- =========================================================
-- Faz 5 tamamlama: partnerin kendisine gelen yönlendirmeyi
-- kabul/ret etmesi. partner_admin (kendi partneri) veya
-- partner_employee (kendine atanmışsa) çağırabilir. Ret
-- durumunda closed_at set edilir (Migration 5'teki "tek aktif
-- yönlendirme" kuralı gereği — kabul ise açık kalır, süreç devam
-- eder, kapanış sales_outcomes/offer akışında olur).
-- =========================================================

create or replace function public.respond_to_referral(
  p_referral_id uuid,
  p_decision text,
  p_rejection_reason text default null
)
returns public.partner_referrals
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_role public.app_role := private.current_role();
  v_referral public.partner_referrals;
  v_result public.partner_referrals;
begin
  if p_decision not in ('accept', 'reject') then
    raise exception 'Geçersiz karar: accept veya reject olmalı';
  end if;

  select * into v_referral from public.partner_referrals where id = p_referral_id;
  if v_referral is null then
    raise exception 'Yönlendirme bulunamadı';
  end if;

  if v_referral.status <> 'pending' then
    raise exception 'Bu yönlendirme zaten yanıtlanmış';
  end if;

  if not (
    (v_caller_role = 'partner_admin' and v_referral.partner_id = private.current_partner_id())
    or (
      v_caller_role = 'partner_employee'
      and v_referral.partner_id = private.current_partner_id()
      and v_referral.assigned_employee_id = auth.uid()
    )
  ) then
    raise exception 'Bu yönlendirmeyi yanıtlama yetkiniz yok';
  end if;

  if p_decision = 'reject' and (p_rejection_reason is null or trim(p_rejection_reason) = '') then
    raise exception 'Ret için bir gerekçe girilmelidir';
  end if;

  update public.partner_referrals
  set
    status = case when p_decision = 'accept' then 'accepted' else 'rejected' end,
    responded_at = now(),
    responded_by = auth.uid(),
    rejection_reason = case when p_decision = 'reject' then p_rejection_reason else null end,
    closed_at = case when p_decision = 'reject' then now() else null end
  where id = p_referral_id
  returning * into v_result;

  perform private.write_audit_log(
    case when p_decision = 'accept' then 'referral_accept' else 'referral_reject' end,
    'partner_referrals', p_referral_id,
    jsonb_build_object('status', v_referral.status),
    jsonb_build_object('status', v_result.status),
    p_rejection_reason
  );

  return v_result;
end;
$$;

revoke execute on function public.respond_to_referral(uuid, text, text) from public;
revoke execute on function public.respond_to_referral(uuid, text, text) from anon;
grant execute on function public.respond_to_referral(uuid, text, text) to authenticated;
