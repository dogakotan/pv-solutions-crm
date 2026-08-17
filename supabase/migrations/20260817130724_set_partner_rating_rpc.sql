-- partners.rating (bkz. partners_add_rating.sql) "admin tarafından manuel
-- girilen bir performans/memnuniyet skoru" olarak tanımlanmıştı, ama bunu
-- yazacak hiçbir RPC/form yoktu — yalnızca okunuyordu (partner detay +
-- performans sekmesi). Bu RPC eksik yazma yolunu tamamlıyor.

create or replace function public.set_partner_rating(
  p_partner_id uuid,
  p_rating numeric
)
returns public.partners
language plpgsql
security definer
set search_path = public
as $$
declare
  v_partner public.partners;
  v_old_rating numeric;
begin
  if private.current_role() is distinct from 'pv_admin' then
    raise exception 'Partner puanını yalnızca admin değiştirebilir';
  end if;

  if p_rating is not null and (p_rating < 0 or p_rating > 5) then
    raise exception 'Puan 0 ile 5 arasında olmalıdır';
  end if;

  select * into v_partner from public.partners where id = p_partner_id;
  if v_partner is null then
    raise exception 'Partner bulunamadı';
  end if;
  v_old_rating := v_partner.rating;

  update public.partners
  set rating = p_rating
  where id = p_partner_id
  returning * into v_partner;

  perform private.write_audit_log(
    'set_partner_rating', 'partners', p_partner_id,
    jsonb_build_object('rating', v_old_rating),
    jsonb_build_object('rating', p_rating),
    null
  );

  return v_partner;
end;
$$;

revoke execute on function public.set_partner_rating(uuid, numeric) from public;
revoke execute on function public.set_partner_rating(uuid, numeric) from anon;
grant execute on function public.set_partner_rating(uuid, numeric) to authenticated;
