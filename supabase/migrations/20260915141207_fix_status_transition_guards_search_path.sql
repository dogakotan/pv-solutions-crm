-- enforce_status_transition_guards migration'ındaki üç trigger fonksiyonu
-- search_path belirtmeden oluşturulmuş — get_advisors bunu
-- function_search_path_mutable olarak işaretledi. Bu fonksiyonlar tabloya
-- doğrudan erişmiyor (yalnızca OLD/NEW üzerinden karar veriyor), yani
-- pratikte istismar edilebilir bir yüzey yok, ama projedeki her fonksiyon
-- search_path'i sabitliyor — tutarlılık için burada da yapılıyor.
create or replace function private.enforce_offers_status_transition()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if old.status <> 'open' and new.status = 'open' then
    raise exception 'Geçersiz teklif durum geçişi: % -> % (kesinleşmiş bir teklif başlangıç durumuna döndürülemez)', old.status, new.status;
  end if;
  return new;
end;
$$;

create or replace function private.enforce_offer_versions_status_transition()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if old.status not in ('draft', 'sent') and new.status in ('draft', 'sent') then
    raise exception 'Geçersiz teklif revizyonu durum geçişi: % -> % (kesinleşmiş bir revizyon başlangıç durumuna döndürülemez)', old.status, new.status;
  end if;
  return new;
end;
$$;

create or replace function private.enforce_partner_referrals_status_transition()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if old.status <> 'pending' and new.status = 'pending' then
    raise exception 'Geçersiz yönlendirme durum geçişi: % -> % (kesinleşmiş bir yönlendirme beklemede durumuna döndürülemez)', old.status, new.status;
  end if;
  return new;
end;
$$;
