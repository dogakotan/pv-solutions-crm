-- createActivity app katmanında iki ayrı network round trip yapıyordu:
-- activities'e INSERT, sonra (nextFollowUpAt girilmişse) leads'e ayrı bir
-- UPDATE. İkinci adım başarısız olursa aktivite zaten commit olmuş oluyordu
-- (yarım kalan yazma). RPC'nin çağrıldığı tek yer (leads/[id]/actions.ts)
-- yalnızca admin/first_call/sales rolleri için erişilebilir (requireRole),
-- hepsi leads_update_pv RLS'inde kapsanıyor — bu yüzden SECURITY DEFINER'a
-- gerek yok, SECURITY INVOKER (varsayılan) ile RLS zaten doğru uygulanıyor.
create or replace function public.create_activity(
  p_lead_id uuid,
  p_activity_type text,
  p_title text,
  p_description text default null,
  p_occurred_at timestamptz default now(),
  p_next_follow_up_at timestamptz default null,
  p_visibility text default 'pv_internal',
  p_referral_id uuid default null
)
returns public.activities
language plpgsql
set search_path = public
as $$
declare
  v_activity public.activities;
begin
  insert into public.activities (
    lead_id, activity_type, visibility, referral_id, title, description,
    occurred_at, next_follow_up_at, created_by
  ) values (
    p_lead_id, p_activity_type, p_visibility, p_referral_id, p_title, p_description,
    p_occurred_at, p_next_follow_up_at, auth.uid()
  )
  returning * into v_activity;

  if p_next_follow_up_at is not null then
    update public.leads
    set next_follow_up_at = p_next_follow_up_at
    where id = p_lead_id;

    if not found then
      raise exception 'Lead bulunamadı';
    end if;
  end if;

  return v_activity;
end;
$$;

revoke execute on function public.create_activity(
  uuid, text, text, text, timestamptz, timestamptz, text, uuid
) from public;
revoke execute on function public.create_activity(
  uuid, text, text, text, timestamptz, timestamptz, text, uuid
) from anon;
grant execute on function public.create_activity(
  uuid, text, text, text, timestamptz, timestamptz, text, uuid
) to authenticated;
