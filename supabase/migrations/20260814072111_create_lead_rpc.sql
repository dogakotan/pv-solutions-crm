-- Lead oluşturma + idempotency key tüketimi artık tek SECURITY DEFINER
-- RPC'de atomik yapılıyor. Önceki durumda first-call/new-lead/actions.ts
-- anahtarı ayrı bir insert ile tüketip lead insert'i başarısız olursa
-- release_idempotency_key RPC'siyle elle geri alıyordu. Artık ikisi aynı
-- transaction'da: lead insert başarısız olursa anahtar insert'i de
-- otomatik geri alınır, elle telafiye gerek kalmaz.

create or replace function public.create_lead(
  p_customer_type text,
  p_customer_name text,
  p_phone text,
  p_city text,
  p_source text,
  p_idempotency_key uuid default null
)
returns public.leads
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_role public.app_role := private.current_role();
  v_lead public.leads;
begin
  if not coalesce(
    v_caller_role in ('pv_admin', 'pv_sales', 'first_call'),
    false
  ) then
    raise exception 'Lead oluşturma yetkiniz yok';
  end if;

  if p_idempotency_key is not null then
    insert into public.idempotency_keys (key) values (p_idempotency_key);
  end if;

  insert into public.leads (
    customer_type, customer_name, phone, city, source,
    owner_id, created_by, first_call_user_id
  ) values (
    p_customer_type, p_customer_name, p_phone, p_city, p_source,
    auth.uid(), auth.uid(), auth.uid()
  )
  returning * into v_lead;

  return v_lead;
end;
$$;

revoke execute on function public.create_lead(text, text, text, text, text, uuid) from public;
grant execute on function public.create_lead(text, text, text, text, text, uuid) to authenticated;
