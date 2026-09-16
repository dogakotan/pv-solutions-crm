-- Yol haritası 3.3: kazanılan bir satış sonrası kurulum/sözleşme/ödeme
-- takibi hiç yoktu. material_purchase_status ve erp_order_number
-- kolonları sales_outcomes_core migration'ından beri şemada duruyor ama
-- hiçbir RPC parametre olarak almıyordu (kod yorumunda "Faz 8'in ilk
-- sürümü kazanç/kayıp kaydına odaklanıyor" diye bilinçli bir erteleme
-- olarak belgelenmişti). Kapsam kasıtlı olarak dar tutuluyor: yalnızca
-- malzeme/ERP takibi. partner_performance_impact/performance_impact_reason
-- BİLİNÇLİ OLARAK dışarıda bırakıldı — bu, ayrı ve henüz çözülmemiş bir
-- yol haritası maddesiyle (3.6, partner puanının hesaplanan performanstan
-- kopuk olması) aynı konu; birlikte ele almak daha büyük ve daha riskli
-- bir değişiklik olurdu.
alter table public.sales_outcomes
  add constraint sales_outcomes_material_purchase_status_check
  check (material_purchase_status is null or material_purchase_status in ('pending', 'ordered', 'delivered'));

create or replace function public.update_sales_outcome_fulfillment(
  p_lead_id uuid,
  p_material_purchase_status text,
  p_erp_order_number text default null
)
returns public.sales_outcomes
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_caller_role public.app_role := private.current_role();
  v_lead public.leads;
  v_existing public.sales_outcomes;
  v_result public.sales_outcomes;
begin
  if p_material_purchase_status not in ('pending', 'ordered', 'delivered') then
    raise exception 'Geçersiz malzeme durumu: pending, ordered veya delivered olmalı';
  end if;

  select * into v_lead from public.leads where id = p_lead_id and deleted_at is null;
  if v_lead is null then
    raise exception 'Lead bulunamadı';
  end if;

  if not coalesce(
    v_caller_role = 'pv_admin' or (v_caller_role = 'pv_sales' and v_lead.owner_id = auth.uid()),
    false
  ) then
    raise exception 'Bu satış sonucunu güncelleme yetkiniz yok';
  end if;

  select * into v_existing from public.sales_outcomes where lead_id = p_lead_id;
  if v_existing is null then
    raise exception 'Bu lead için bir satış sonucu kaydı yok';
  end if;

  if v_existing.outcome <> 'won' then
    raise exception 'Malzeme takibi yalnızca kazanılan satışlar için geçerli';
  end if;

  update public.sales_outcomes
  set
    material_purchase_status = p_material_purchase_status,
    erp_order_number = nullif(trim(coalesce(p_erp_order_number, '')), ''),
    updated_by = auth.uid()
  where lead_id = p_lead_id
  returning * into v_result;

  perform private.write_audit_log(
    'update_sales_outcome_fulfillment', 'leads', p_lead_id,
    jsonb_build_object(
      'material_purchase_status', v_existing.material_purchase_status,
      'erp_order_number', v_existing.erp_order_number
    ),
    jsonb_build_object(
      'material_purchase_status', v_result.material_purchase_status,
      'erp_order_number', v_result.erp_order_number
    ),
    null
  );

  return v_result;
end;
$$;

revoke execute on function public.update_sales_outcome_fulfillment(uuid, text, text) from public;
revoke execute on function public.update_sales_outcome_fulfillment(uuid, text, text) from anon;
grant execute on function public.update_sales_outcome_fulfillment(uuid, text, text) to authenticated;
