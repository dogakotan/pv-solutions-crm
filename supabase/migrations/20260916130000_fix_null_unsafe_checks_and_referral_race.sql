-- Dördüncü tur ("tüm dosyaları oku ve bugfix yap") — tam kod taramasında
-- bulunan üç gerçek güvenlik açığı:
--
-- 1) claim_lead ve list_active_sales_users (workload varyantı), 20260826130314
--    migration'ında "list_active_sales_users" için düzeltilen NULL-unsafe
--    `not in` deseni ile yazılmış/geri yazılmış durumdaydı. current_role()
--    deaktif veya hiç rol ataması olmayan bir authenticated kullanıcı için
--    NULL döner; `NULL not in (...)` de NULL olur, plpgsql'de `if NULL then`
--    false sayılır ve exception hiç atılmadan fonksiyon devam eder.
--    claim_lead'de bu, deaktif/rolsüz bir hesabın havuzdaki HERHANGİ bir
--    lead'i sahiplenebilmesi; list_active_sales_users'ta ise tüm aktif
--    pv_sales kullanıcılarının isim/id/açık-lead listesinin sızması demek.
--    İkisi de coalesce(..., false) NULL-safe desenine çekildi.
--
-- 2) respond_to_referral check-then-act yapıyordu (ayrı select + update,
--    satır kilidi yok) — respond_to_offer'da daha önce düzeltilen çift
--    tıklama/yarış durumunun aynısı burada da vardı. update artık
--    WHERE status='pending' ile atomik.
create or replace function public.claim_lead(p_lead_id uuid)
returns leads
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_caller_role public.app_role := private.current_role();
  v_lead public.leads;
begin
  if not coalesce(v_caller_role in ('first_call', 'pv_admin'), false) then
    raise exception 'Bu işlemi yapma yetkiniz yok';
  end if;

  perform set_config('app.bypass_lead_protection', 'on', true);

  update public.leads
  set first_call_user_id = auth.uid()
  where id = p_lead_id
    and deleted_at is null
    and first_call_user_id is null
  returning * into v_lead;

  if not found then
    raise exception 'Lead bulunamadı veya zaten sahiplenilmiş';
  end if;

  perform private.write_audit_log(
    'claim_lead', 'leads', p_lead_id,
    jsonb_build_object('first_call_user_id', null),
    jsonb_build_object('first_call_user_id', auth.uid()),
    null
  );

  return v_lead;
end;
$function$;

create or replace function public.list_active_sales_users()
returns table(id uuid, full_name text, open_lead_count bigint)
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
  select
    p.id,
    p.full_name,
    (
      select count(*)
      from public.leads l
      where l.sales_user_id = p.id
        and l.deleted_at is null
        and l.stage not in ('won', 'lost', 'sale_registered')
    ) as open_lead_count
  from public.profiles p
  join public.user_role_assignments ura on ura.user_id = p.id
  where p.is_active = true and ura.role = 'pv_sales'
  order by p.full_name;
end;
$$;

revoke execute on function public.list_active_sales_users() from public;
revoke execute on function public.list_active_sales_users() from anon;
grant execute on function public.list_active_sales_users() to authenticated;

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

  -- Check-then-act idi (satır kilidi yok) — respond_to_offer'da düzeltilen
  -- çift tıklama/yarış durumunun aynısı burada da vardı. update artık
  -- WHERE status='pending' ile atomik.
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
