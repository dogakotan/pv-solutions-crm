-- Bir kere 'lost' olarak işaretlenen lead'in pipeline'a geri dönüş yolu
-- yoktu (NEXT_STAGE lost/won/sale_registered için hiç giriş taşımıyor,
-- hiçbir RPC de yeniden açmıyordu). Sabit bir yeniden-giriş noktasına
-- ('contacted') dönüyor — yeni bir satış sonucu kaydedildiğinde
-- record_sales_outcome zaten upsert ile eski 'lost' kaydının üzerine
-- yazıyor (bkz. fix_record_sales_outcome_correction_referral), bu
-- yüzden sales_outcomes satırına burada dokunmaya gerek yok.
create or replace function public.reactivate_lead(p_lead_id uuid)
returns leads
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_caller_role public.app_role := private.current_role();
  v_lead public.leads;
begin
  select * into v_lead from public.leads where id = p_lead_id and deleted_at is null;
  if v_lead is null then
    raise exception 'Lead bulunamadı';
  end if;

  if v_lead.stage != 'lost' then
    raise exception 'Yalnızca kaybedilmiş bir lead yeniden açılabilir';
  end if;

  if not coalesce(
    v_caller_role = 'pv_admin' or (v_caller_role = 'pv_sales' and v_lead.owner_id = auth.uid()),
    false
  ) then
    raise exception 'Bu lead için yeniden açma yetkiniz yok';
  end if;

  update public.leads set stage = 'contacted' where id = p_lead_id returning * into v_lead;

  perform private.write_audit_log(
    'reactivate_lead', 'leads', p_lead_id,
    jsonb_build_object('stage', 'lost'),
    jsonb_build_object('stage', 'contacted'),
    null
  );

  return v_lead;
end;
$function$;

revoke execute on function public.reactivate_lead(uuid) from public;
revoke execute on function public.reactivate_lead(uuid) from anon;
grant execute on function public.reactivate_lead(uuid) to authenticated;
