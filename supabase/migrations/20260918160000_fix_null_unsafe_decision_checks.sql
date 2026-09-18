-- Dokuzuncu tur inceleme, orta öncelik: respond_to_referral ve
-- respond_to_offer'ın "p_decision not in ('accept','reject')" kontrolü
-- NULL-unsafe'ti — 20260916130000'in başlığı bu sınıfı düzelttiğini iddia
-- etse de aslında yalnızca claim_lead/list_active_sales_users'ın rol
-- kontrollerini düzeltmişti, bu iki fonksiyonun kendi karar kontrolüne hiç
-- dokunmamıştı. p_decision NULL gönderilirse `NULL not in (...)` NULL
-- olur, plpgsql'de `if NULL then` false sayılır ve exception hiç
-- atılmadan devam edilir — sonrasındaki `case when p_decision = 'accept'
-- ... else 'rejected' end` NULL'u sessizce "reject" olarak işler. İkisi de
-- coalesce(..., false) NULL-safe desenine çekildi.
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
    (v_caller_role = 'partner_admin' and v_referral.partner_id = private.current_partner_id())
    or (
      v_caller_role = 'partner_employee'
      and v_referral.partner_id = private.current_partner_id()
      and v_referral.assigned_employee_id = auth.uid()
    ),
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

create or replace function public.respond_to_offer(
  p_offer_version_id uuid,
  p_decision text
)
returns public.offer_versions
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_caller_role public.app_role := private.current_role();
  v_version public.offer_versions;
  v_offer public.offers;
  v_lead public.leads;
  v_result public.offer_versions;
begin
  if not coalesce(p_decision in ('accept', 'reject'), false) then
    raise exception 'Geçersiz karar: accept veya reject olmalı';
  end if;

  select * into v_version from public.offer_versions where id = p_offer_version_id;
  if v_version is null then
    raise exception 'Teklif revizyonu bulunamadı';
  end if;

  select * into v_offer from public.offers where id = v_version.offer_id;

  if not coalesce(
    v_caller_role = 'partner_admin'
    and exists (
      select 1 from public.partner_referrals pr
      where pr.id = v_offer.referral_id and pr.partner_id = private.current_partner_id()
    )
    and private.lead_not_deleted(v_offer.lead_id),
    false
  ) then
    raise exception 'Bu teklifi yanıtlama yetkiniz yok';
  end if;

  if v_version.status <> 'sent' then
    raise exception 'Yalnızca gönderilmiş bir revizyon yanıtlanabilir';
  end if;

  update public.offer_versions
  set status = case when p_decision = 'accept' then 'accepted' else 'rejected' end
  where id = p_offer_version_id and status = 'sent'
  returning * into v_result;

  if v_result is null then
    raise exception 'Yalnızca gönderilmiş bir revizyon yanıtlanabilir';
  end if;

  if p_decision = 'reject' then
    update public.offers set status = 'rejected' where id = v_offer.id;
  end if;

  perform private.write_audit_log(
    case when p_decision = 'accept' then 'offer_accept' else 'offer_reject' end,
    'offer_versions', p_offer_version_id,
    jsonb_build_object('status', v_version.status),
    jsonb_build_object('status', v_result.status),
    null
  );

  select * into v_lead from public.leads where id = v_offer.lead_id;

  if v_version.created_by is not null then
    insert into public.notifications (recipient_user_id, type, title, message, entity_type, entity_id, priority)
    values (
      v_version.created_by,
      case when p_decision = 'accept' then 'offer_accepted' else 'offer_rejected' end,
      case when p_decision = 'accept' then 'Teklif kabul edildi' else 'Teklif reddedildi' end,
      coalesce(v_lead.lead_no || ' — ' || v_lead.customer_name, 'Lead') || ' — Rev.' || v_version.revision_no,
      'offer', v_offer.id,
      case when p_decision = 'reject' then 'high' else 'normal' end
    );
  end if;

  return v_result;
end;
$$;
