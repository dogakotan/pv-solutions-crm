-- leads/profiles/notifications'ın aksine offers/offer_versions'ta koruma
-- tamamen konvansiyona dayanıyordu: uygulama kodu şu an hiç doğrudan
-- .update() çağırmıyor, RLS ise bunu izin veriyor. offer_versions'un
-- kendi tablo yorumu zaten "gönderilmiş revizyonların ticari alanları
-- değiştirilmez, yeni revizyon açılır" diyor — bu trigger'lar bunu
-- mekanik olarak zorunlu kılıyor. Hiçbir mevcut RPC bu alanlara UPDATE
-- yapmıyor (yalnızca status'a — create_offer/revise_offer INSERT,
-- record_sales_outcome ve expire_stale_offer_versions_cron yalnızca
-- status'u güncelliyor), bu yüzden bypass GUC'una gerek yok.
create or replace function private.protect_offers_privileged_columns()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if private.current_role() = 'pv_admin' then
    return new;
  end if;

  if new.lead_id is distinct from old.lead_id
     or new.referral_id is distinct from old.referral_id
     or new.offer_no is distinct from old.offer_no
     or new.created_by is distinct from old.created_by
     or new.created_by_organization_type is distinct from old.created_by_organization_type
  then
    raise exception 'Bu alanlar yalnızca yetkili sunucu işlemleri tarafından değiştirilebilir';
  end if;

  return new;
end;
$$;

create trigger protect_offers_privileged_columns
before update on public.offers
for each row execute function private.protect_offers_privileged_columns();

create or replace function private.protect_offer_versions_immutable_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if private.current_role() = 'pv_admin' then
    return new;
  end if;

  if new.offer_id is distinct from old.offer_id
     or new.revision_no is distinct from old.revision_no
     or new.amount is distinct from old.amount
     or new.currency is distinct from old.currency
     or new.vat_included is distinct from old.vat_included
     or new.valid_until is distinct from old.valid_until
     or new.scope_summary is distinct from old.scope_summary
     or new.payment_method is distinct from old.payment_method
     or new.shipping_terms is distinct from old.shipping_terms
     or new.created_by is distinct from old.created_by
     or new.sent_at is distinct from old.sent_at
  then
    raise exception 'Gönderilmiş bir teklif revizyonunun ticari alanları değiştirilemez — yeni bir revizyon açın';
  end if;

  return new;
end;
$$;

create trigger protect_offer_versions_immutable_fields
before update on public.offer_versions
for each row execute function private.protect_offer_versions_immutable_fields();
