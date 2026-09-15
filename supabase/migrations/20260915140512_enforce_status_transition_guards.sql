-- Yol haritası 2.3: offers/offer_versions/partner_referrals'ın status
-- kolonlarında CHECK kısıtları yalnızca üyeliği doğruluyor (geçerli bir
-- enum değeri mi), geçişi doğrulamıyor — DB seviyesinde hiçbir şey
-- "accepted -> draft" gibi anlamsız bir geriye dönüşü engellemiyor.
-- Bugün güvenli olmasının tek sebebi, bu kolonları yazan her RPC'nin
-- doğru yönde yazması; bu bir garanti değil, bir konvansiyon.
--
-- record_sales_outcome (bkz. fix_record_sales_outcome_correction_referral)
-- bu üç kolona yazarken FROM durumuna göre bir WHERE koşulu taşımıyor —
-- örn. sent/superseded/expired bir teklif revizyonunu "accepted"
-- işaretleyebiliyor (sales daha sonra "asıl kazanan aslında şu eski
-- revizyondu" diye düzeltme yapabilsin diye), ve bir referral'ı
-- completed<->cancelled arasında (won<->lost düzeltmesi) durumundan
-- bağımsız olarak taşıyabiliyor. Bu yüzden burada eklenen kural kasıtlı
-- olarak dar tutuldu: yalnızca kesinleşmiş bir kaydın BAŞLANGIÇ
-- durumuna geri dönmesini engelliyor (bulgudaki somut örnek buydu),
-- bugün gerçekten kullanılan hiçbir ileri/düzeltme geçişine dokunmuyor.
create or replace function private.enforce_offers_status_transition()
returns trigger
language plpgsql
as $$
begin
  if old.status <> 'open' and new.status = 'open' then
    raise exception 'Geçersiz teklif durum geçişi: % -> % (kesinleşmiş bir teklif başlangıç durumuna döndürülemez)', old.status, new.status;
  end if;
  return new;
end;
$$;

drop trigger if exists offers_status_transition_guard on public.offers;
create trigger offers_status_transition_guard
before update of status on public.offers
for each row
when (old.status is distinct from new.status)
execute function private.enforce_offers_status_transition();

create or replace function private.enforce_offer_versions_status_transition()
returns trigger
language plpgsql
as $$
begin
  if old.status not in ('draft', 'sent') and new.status in ('draft', 'sent') then
    raise exception 'Geçersiz teklif revizyonu durum geçişi: % -> % (kesinleşmiş bir revizyon başlangıç durumuna döndürülemez)', old.status, new.status;
  end if;
  return new;
end;
$$;

drop trigger if exists offer_versions_status_transition_guard on public.offer_versions;
create trigger offer_versions_status_transition_guard
before update of status on public.offer_versions
for each row
when (old.status is distinct from new.status)
execute function private.enforce_offer_versions_status_transition();

create or replace function private.enforce_partner_referrals_status_transition()
returns trigger
language plpgsql
as $$
begin
  if old.status <> 'pending' and new.status = 'pending' then
    raise exception 'Geçersiz yönlendirme durum geçişi: % -> % (kesinleşmiş bir yönlendirme beklemede durumuna döndürülemez)', old.status, new.status;
  end if;
  return new;
end;
$$;

drop trigger if exists partner_referrals_status_transition_guard on public.partner_referrals;
create trigger partner_referrals_status_transition_guard
before update of status on public.partner_referrals
for each row
when (old.status is distinct from new.status)
execute function private.enforce_partner_referrals_status_transition();
