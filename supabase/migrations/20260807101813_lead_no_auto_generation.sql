-- lead_no artık trigger ile otomatik üretiliyor (LEAD-{yıl}-{4 haneli sıra}),
-- client tarafında Date.now() ile üretilen geçici/çakışabilir değer kaldırıldı.
-- Kolon NOT NULL kalıyor gibi görünse de trigger BEFORE INSERT'te NEW.lead_no'yu
-- constraint kontrolünden önce dolduruyor; nullable yapmamızın tek amacı
-- Supabase tip üretecinin Insert tipinde lead_no'yu opsiyonel işaretlemesi.
alter table public.leads alter column lead_no drop not null;

create or replace function private.generate_lead_no()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_year int;
  v_seq int;
begin
  if new.lead_no is not null and new.lead_no <> '' then
    return new;
  end if;

  v_year := extract(year from now())::int;

  insert into public.lead_no_sequences (year, last_value)
  values (v_year, 1)
  on conflict (year) do update set last_value = lead_no_sequences.last_value + 1
  returning last_value into v_seq;

  new.lead_no := 'LEAD-' || v_year || '-' || lpad(v_seq::text, 4, '0');
  return new;
end;
$$;

drop trigger if exists generate_lead_no_before_insert on public.leads;
create trigger generate_lead_no_before_insert
before insert on public.leads
for each row
execute function private.generate_lead_no();
