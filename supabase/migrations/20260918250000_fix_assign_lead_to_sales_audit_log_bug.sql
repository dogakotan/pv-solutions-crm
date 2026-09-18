-- Onbirinci tur inceleme, yüksek bulgu: v_lead, izin kontrolü için lead'in
-- ESKİ halini tutuyordu, ama `update ... returning * into v_lead` bu
-- değişkeni YENİ (güncellenmiş) satırla eziyordu — write_audit_log çağrısı
-- bu ezilmiş v_lead'i "old_values" olarak kullandığı için old_values ve
-- new_values her zaman aynı (yeni) sales_user_id'yi taşıyordu. Denetim
-- kaydı, bir lead'in kimden kime devredildiğini asla göstermiyordu.
-- set_partner_status/set_partner_rating/set_user_role/set_user_active'in
-- zaten uyguladığı desen (RETURNING'den ÖNCE eski skaler değeri ayrı bir
-- değişkene almak) burada da uygulandı.
create or replace function public.assign_lead_to_sales(
  p_lead_id uuid,
  p_sales_user_id uuid
)
returns public.leads
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_role public.app_role := private.current_role();
  v_lead public.leads;
  v_old_sales_user_id uuid;
  v_target_role public.app_role;
  v_target_active boolean;
begin
  select * into v_lead from public.leads where id = p_lead_id and deleted_at is null;
  if v_lead is null then
    raise exception 'Lead bulunamadı';
  end if;

  v_old_sales_user_id := v_lead.sales_user_id;

  if not coalesce(
    v_caller_role = 'pv_admin'
    or (v_caller_role = 'first_call' and (v_lead.created_by = auth.uid() or v_lead.first_call_user_id = auth.uid())),
    false
  ) then
    raise exception 'Bu lead''i satış çalışanına atama yetkiniz yok';
  end if;

  select ura.role, p.is_active into v_target_role, v_target_active
  from public.profiles p
  join public.user_role_assignments ura on ura.user_id = p.id
  where p.id = p_sales_user_id;

  if v_target_role is distinct from 'pv_sales' or coalesce(v_target_active, false) = false then
    raise exception 'Hedef kullanıcı aktif bir satış çalışanı değil';
  end if;

  perform set_config('app.bypass_lead_protection', 'on', true);

  update public.leads
  set sales_user_id = p_sales_user_id,
      owner_id = p_sales_user_id
  where id = p_lead_id
  returning * into v_lead;

  perform private.write_audit_log(
    'assign_sales', 'leads', p_lead_id,
    jsonb_build_object('sales_user_id', v_old_sales_user_id),
    jsonb_build_object('sales_user_id', p_sales_user_id),
    null
  );

  insert into public.notifications (recipient_user_id, type, title, message, entity_type, entity_id, priority)
  values (
    p_sales_user_id, 'lead_assigned', 'Yeni lead atandı',
    v_lead.lead_no || ' — ' || v_lead.customer_name,
    'lead', p_lead_id, 'normal'
  );

  return v_lead;
end;
$$;
