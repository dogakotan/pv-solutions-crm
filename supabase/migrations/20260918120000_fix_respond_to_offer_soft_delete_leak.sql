-- Dokuzuncu tur inceleme, yüksek bulgu: 20260917121116_fix_soft_deleted_lead_leak_to_partners.sql
-- partner'a açık her SELECT/UPDATE yolunu (partner_referrals, offers_update,
-- activities, sales_outcomes) deleted_at is null kontrolüyle kapatmıştı, ama
-- respond_to_offer'ı (offer_versions.status'u partner_admin'in mutasyona
-- uğratabildiği TEK RPC — offer_versions_update RLS policy'sinde hiç partner
-- dalı yok) kapsam dışında bırakmıştı. pv_admin bir lead'i soft-delete
-- ettikten sonra partner, elindeki eski offer_version_id ile hâlâ kabul/red
-- yapabiliyordu — hem niyet edilen kilidin bypass'ı hem de "silinmiş" bir
-- kaydın ticari şartlarının küçük bir ifşası.
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
  if p_decision not in ('accept', 'reject') then
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
