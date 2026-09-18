-- Onbirinci tur inceleme, yüksek bulgu: respond_to_offer 20260918120000'de
-- private.lead_not_deleted ile kapatılmıştı ama ikiz RPC'si
-- respond_to_referral aynı korumayı hiç almamıştı — pv_admin bir lead'i
-- soft-silse bile partner, elindeki eski referral_id ile hâlâ kabul/ret
-- yapabiliyordu (kabul durumunda referral 'accepted'e dönüp lead'in
-- görünüşte hâlâ aktif bir yönlendirmesi varmış gibi durmasına yol
-- açıyordu; ret durumunda ise reddedenin referred_by'ına silinmiş lead'in
-- lead_no/customer_name'i sızıyordu).
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
  v_lead public.leads;
begin
  if not coalesce(p_decision in ('accept', 'reject'), false) then
    raise exception 'Geçersiz karar: accept veya reject olmalı';
  end if;

  select * into v_referral from public.partner_referrals where id = p_referral_id;
  if v_referral is null then
    raise exception 'Yönlendirme bulunamadı';
  end if;

  if v_referral.status <> 'pending' then
    raise exception 'Bu yönlendirme zaten yanıtlanmış';
  end if;

  if not coalesce(
    (
      (v_caller_role = 'partner_admin' and v_referral.partner_id = private.current_partner_id())
      or (
        v_caller_role = 'partner_employee'
        and v_referral.partner_id = private.current_partner_id()
        and v_referral.assigned_employee_id = auth.uid()
      )
    )
    and private.lead_not_deleted(v_referral.lead_id),
    false
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
  where id = p_referral_id and status = 'pending'
  returning * into v_result;

  if v_result is null then
    raise exception 'Bu yönlendirme zaten yanıtlanmış';
  end if;

  perform private.write_audit_log(
    case when p_decision = 'accept' then 'referral_accept' else 'referral_reject' end,
    'partner_referrals', p_referral_id,
    jsonb_build_object('status', v_referral.status),
    jsonb_build_object('status', v_result.status),
    p_rejection_reason
  );

  if v_referral.referred_by is not null then
    select * into v_lead from public.leads where id = v_referral.lead_id;

    insert into public.notifications (recipient_user_id, type, title, message, entity_type, entity_id, priority)
    values (
      v_referral.referred_by,
      case when p_decision = 'accept' then 'referral_accepted' else 'referral_rejected' end,
      case when p_decision = 'accept' then 'Yönlendirme kabul edildi' else 'Yönlendirme reddedildi' end,
      coalesce(v_lead.lead_no || ' — ' || v_lead.customer_name, 'Lead') ||
        case when p_decision = 'reject' then ' (' || p_rejection_reason || ')' else '' end,
      'referral', p_referral_id,
      case when p_decision = 'reject' then 'high' else 'normal' end
    );
  end if;

  return v_result;
end;
$$;
