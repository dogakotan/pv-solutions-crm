-- leads-overview-tabs.tsx'teki tasarım yorumu partnere yönlendirilen
-- leadlerin aşama='referred' ve sonrası olacağını varsayıyordu ("Bana
-- Yönlendirilenler" sekmesi bu yüzden kaldırılmıştı), ama assign_lead_to_partner
-- hiçbir zaman leads.stage'i güncellemiyordu — lead önceki aşamasında
-- (örn. "İletişime Geçildi") takılı kalıyordu ve "Yönlendirildi" aşaması
-- pratikte hiç oluşmuyordu.
--
-- qualify_lead'deki "yalnızca ileri" deseniyle aynı: yalnızca lead henüz
-- new/contacted'daysa referred'a ilerletiliyor — daha ileri bir aşamada
-- (keşif/teklif/pazarlık) olan bir lead yeniden bir partnere yönlendirilirse
-- aşaması geriye alınmıyor.
create or replace function public.assign_lead_to_partner(
  p_lead_id uuid,
  p_partner_id uuid,
  p_employee_id uuid default null,
  p_response_due_at timestamptz default null,
  p_share_note text default null
)
returns public.partner_referrals
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_role public.app_role := private.current_role();
  v_lead public.leads;
  v_partner_status text;
  v_referral public.partner_referrals;
  v_due timestamptz := coalesce(p_response_due_at, now() + interval '2 days');
begin
  select * into v_lead from public.leads where id = p_lead_id and deleted_at is null;
  if v_lead is null then
    raise exception 'Lead bulunamadı';
  end if;

  if not coalesce(
    v_caller_role = 'pv_admin'
    or (v_caller_role = 'pv_sales' and (v_lead.owner_id = auth.uid() or v_lead.sales_user_id = auth.uid())),
    false
  ) then
    raise exception 'Bu lead için partner ataması yapma yetkiniz yok';
  end if;

  select status into v_partner_status from public.partners where id = p_partner_id;
  if v_partner_status is distinct from 'active' then
    raise exception 'Hedef partner aktif değil';
  end if;

  if p_employee_id is not null then
    if not exists (
      select 1
      from public.profiles pr
      join public.user_role_assignments ura on ura.user_id = pr.id
      where pr.id = p_employee_id
        and pr.partner_id = p_partner_id
        and ura.role in ('partner_admin','partner_employee')
    ) then
      raise exception 'Atanan çalışan bu partnere ait değil';
    end if;
  end if;

  insert into public.partner_referrals (
    lead_id, partner_id, referred_by, assigned_employee_id,
    response_due_at, share_note
  )
  values (
    p_lead_id, p_partner_id, auth.uid(), p_employee_id,
    v_due, p_share_note
  )
  returning * into v_referral;

  update public.leads
  set stage = case when stage in ('new', 'contacted') then 'referred' else stage end
  where id = p_lead_id;

  perform private.write_audit_log(
    'assign_partner', 'leads', p_lead_id,
    null,
    jsonb_build_object('partner_id', p_partner_id, 'assigned_employee_id', p_employee_id),
    null
  );

  if p_employee_id is not null then
    insert into public.notifications (recipient_user_id, type, title, message, entity_type, entity_id, priority)
    values (
      p_employee_id, 'referral_received', 'Yeni bir müşteri yönlendirildi',
      v_lead.lead_no || ' — ' || v_lead.customer_name,
      'referral', v_referral.id, 'normal'
    );
  else
    insert into public.notifications (recipient_user_id, type, title, message, entity_type, entity_id, priority)
    select ura.user_id, 'referral_received', 'Yeni bir müşteri yönlendirildi',
      v_lead.lead_no || ' — ' || v_lead.customer_name,
      'referral', v_referral.id, 'normal'
    from public.user_role_assignments ura
    join public.profiles pr on pr.id = ura.user_id
    where pr.partner_id = p_partner_id and ura.role = 'partner_admin';
  end if;

  return v_referral;
end;
$$;
