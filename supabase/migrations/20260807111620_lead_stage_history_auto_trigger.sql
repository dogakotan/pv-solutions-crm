-- lead_stage_history tablosu Faz 4'te yapı olarak kuruldu ama hiçbir yerden
-- doldurulmuyordu (migration'ın kendi notu: "otomatik trigger burada YOK").
-- Her stage değişikliğini (manuel düzenleme, assign_lead_to_sales,
-- respond_to_referral, record_sales_outcome — hangi kod yolundan gelirse
-- gelsin) tek noktadan, atlanmaz şekilde yakalamak için AFTER UPDATE
-- trigger'ı tercih edildi; her RPC'ye ayrı ayrı insert eklemek yerine.
create or replace function private.log_lead_stage_change()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.stage is distinct from old.stage then
    insert into public.lead_stage_history (lead_id, from_stage, to_stage, change_source, changed_by)
    values (new.id, old.stage, new.stage, 'system', auth.uid());
  end if;
  return new;
end;
$$;

drop trigger if exists log_lead_stage_change_after_update on public.leads;
create trigger log_lead_stage_change_after_update
after update on public.leads
for each row
execute function private.log_lead_stage_change();
