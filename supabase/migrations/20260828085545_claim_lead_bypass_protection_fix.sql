-- İlk sürüm private.protect_lead_privileged_columns() trigger'ını atlamayı
-- unutmuştu (first_call_user_id korumalı kolonlardan biri) — assign_lead_to_sales
-- ve soft_delete_lead ile aynı desen: set_config ile bypass GUC'unu açıyoruz.
create or replace function public.claim_lead(p_lead_id uuid)
returns public.leads
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_role public.app_role := private.current_role();
  v_lead public.leads;
begin
  if v_caller_role not in ('first_call', 'pv_admin') then
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

  return v_lead;
end;
$$;
