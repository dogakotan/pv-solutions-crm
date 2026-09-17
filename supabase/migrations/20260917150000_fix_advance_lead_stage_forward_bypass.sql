-- Altıncı tur inceleme, açık madde: advance_lead_stage, ulaşılabilir
-- aşamaları DB seviyesinde hiç kısıtlamıyordu — tek koruma istemci
-- tarafındaki NEXT_STAGE haritasıydı (src/types/lead.ts, 'won'/'lost'
-- için hiç girdi yok). Doğrudan bir RPC çağrısı 'won'/'lost'a
-- zıplayabiliyordu: leads.stage 'won' olurken sales_outcomes hiç
-- oluşmuyor (get_salesperson_performance'ın won_amounts'ı sales_outcomes'
-- tan geliyor — sayı şişer, ciro değişmez), partner_referrals
-- pending/accepted kalıp yalnızca cron ile 'expired' oluyor ("kazanılmış
-- lead, süresi dolmuş referral" tutarsızlığı), teklif sonsuza dek
-- 'open' kalıyor. 5. turdaki enforce_leads_stage_transition trigger'ı
-- yalnızca GERİ yönü (won/lost->new) engelliyordu, bu İLERİ yönü değil.
-- record_sales_outcome zaten kendi RPC'sinde leads.stage'i p_outcome'a
-- eşitliyor (bypass GUC'uyla) — won/lost'a giden TEK meşru yol o olmalı.
-- Gerçek SQL rol-taklidiyle doğrulandı: doğrudan 'won' hedefi reddediliyor,
-- normal ileri geçişler (ör. 'contacted') bozulmadı.
create or replace function public.advance_lead_stage(p_lead_id uuid, p_next_stage text)
returns leads
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_caller_role public.app_role := private.current_role();
  v_old_lead public.leads;
  v_lead public.leads;
begin
  select * into v_old_lead from public.leads where id = p_lead_id and deleted_at is null;
  if v_old_lead is null then
    raise exception 'Lead bulunamadı';
  end if;

  if not coalesce(
    v_caller_role = 'pv_admin'
    or (v_caller_role = 'pv_sales' and (v_old_lead.owner_id = auth.uid() or v_old_lead.sales_user_id = auth.uid())),
    false
  ) then
    raise exception 'Bu lead için aşama ilerletme yetkiniz yok';
  end if;

  if p_next_stage in ('won', 'lost') then
    raise exception 'won/lost aşamasına yalnızca record_sales_outcome ile geçilebilir';
  end if;

  update public.leads
  set stage = p_next_stage
  where id = p_lead_id
  returning * into v_lead;

  perform private.write_audit_log(
    'advance_lead_stage', 'leads', p_lead_id,
    jsonb_build_object('stage', v_old_lead.stage),
    jsonb_build_object('stage', v_lead.stage),
    null
  );

  return v_lead;
end;
$function$;
