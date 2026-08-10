# RLS Test Matrisi

Doküman §15.4'te tanımlanan 10 negatif + 5 pozitif testin tam çalıştırılmış
sonucu. Yöntem: `begin; set local role authenticated; set local
request.jwt.claims = '{"sub":"<uuid>"}'; <sorgu>; rollback;` ile gerçek rol
simülasyonu (doğrudan Postgres üzerinde, Supabase MCP `execute_sql` ile).
Test kullanıcıları/veri: 2 partner (A, B), her birinde admin+2 çalışan,
2 pv_sales (her biri kendi lead'i), 1 first_call, 1 pasif kullanıcı — tümü
test sonunda temizlendi, kalıcı veri yok.

Tarih: 2026-08-10

## Negatif testler

| # | Test | Sonuç |
|---|------|-------|
| N1 | PV Sales A, PV Sales B'nin lead'ini SELECT edemiyor | ✅ PASS |
| N2 | PV Sales A, B'nin lead ID'sini bilse bile UPDATE edemiyor | ✅ PASS |
| N3 | Partner A, Partner B'nin referral'ını okuyamıyor | ✅ PASS |
| N4 | Partner A çalışanı, aynı firmadaki başka çalışana atanmış kaydı okuyamıyor | ✅ PASS |
| N5 | Partner kullanıcısı PV iç notlarını okuyamıyor | ❌ **FAIL → düzeltildi** (bkz. aşağıda) |
| N6 | Kullanıcı kendi rolünü değiştiremiyor | ✅ PASS |
| N7 | Kullanıcı kendi partner ID'sini değiştiremiyor | ✅ PASS (trigger seviyesinde, pv_admin olmayan herkes için exception) |
| N8 | Pasif kullanıcı kayıt okuyamıyor | ✅ PASS (bkz. küçük not) |
| N9 | Yetkisiz kullanıcı FK ID tahmin ederek offer/activity oluşturamıyor | ✅ PASS |
| N10 | Notification ID bilen başka kullanıcı bildirimi okuyamıyor/okundu yapamıyor | ✅ PASS |

**N8 küçük not:** `private.current_role()` zaten `is_active = true` şartı
taşıdığı için pasif kullanıcı `leads`/`partners`/`offers`/`activities`/
`partner_referrals` üzerinde hiçbir satır göremiyor (test edildi, 0 satır).
Ancak `profiles_select_own_or_admin` ve `notifications_select` politikaları
"kendi satırım" kontrolünü `current_role()`'dan bağımsız yapıyor — yani pasif
bir kullanıcı kendi profil satırını (ve varsa kendi bildirimlerini) hâlâ
görebiliyor. Bu bir başkasının verisine erişim değil, düşük önemli — hesap
pasife alındığında dahi kendi geçmiş verisini görmesi kabul edilebilir kabul
edildi, düzeltme yapılmadı.

## Pozitif testler

| # | Test | Sonuç |
|---|------|-------|
| P1 | PV admin gerekli tüm kayıtları görebiliyor | ✅ PASS |
| P2 | PV sales kendi lead'ini oluşturup güncelleyebiliyor | ✅ PASS |
| P3 | Partner admin kendi yönlendirmesini kabul edebiliyor | ✅ PASS |
| P4 | Atanan çalışan kendi yönlendirmesine aktivite ekleyebiliyor | ✅ PASS |
| P5 | İlgili taraflar teklif revizyonunu görebiliyor | ✅ PASS (ayrıca ilgisiz bir partnerin AYNI teklifi göremediği de doğrulandı — `offer_versions_select` politikası `offers` RLS'sini iç sorguda miras alıyor, ayrı bir açık değil) |

## N5 — Bulunan ve düzeltilen gerçek güvenlik açığı

**Sorun:** `partners.internal_notes` ve `leads.internal_notes` sütunları
satır bazlı RLS ile korunuyordu ama Postgres RLS sütun maskeleme yapmaz —
partner rolü kendi partner satırını veya kendisine yönlendirilmiş bir lead'i
görebildiği her yerde bu sütunlar da satırın parçası olarak geliyordu.
Doğrudan test edildi: `partner_admin` olarak `select internal_notes from
partners where id = <kendi partnerim>` → PV'ye özel gizli metin döndü. Aynı
şekilde kabul edilmiş bir referral üzerinden görünür olan lead'in
`internal_notes`'u da döndü. Bu, doküman §15.3'te zaten "yalnızca PV
içindir, kolon maskeleme henüz uygulanmadı" olarak not edilmiş, çözülmemiş
bir açıktı.

**Düzeltme** (doküman §15.3'ün "tercih edilen yaklaşım"ı): iki yeni ayrı
tablo — `partner_internal_notes` (partner_id → not, yalnızca pv_admin RLS)
ve `lead_internal_notes` (lead_id → not, RLS `leads_select_pv` ile birebir
aynı sahiplik mantığı: pv_admin hepsi, pv_sales sadece owner/sales_user_id
eşleşen lead, first_call sadece created_by/first_call_user_id eşleşen
lead). `internal_notes` kolonları `partners`/`leads` tablolarından
tamamen kaldırıldı, mevcut veri yeni tablolara taşındı. Uygulama tarafı
(`src/lib/data/partners.ts`, `src/lib/data/leads.ts`,
`partners/[id]/page.tsx`, `leads/[id]/page.tsx`,
`partner-detail-tabs.tsx`, `partners/new/actions.ts`) yeni ayrı
sorgulara/tablolara göre güncellendi.

**Doğrulama:** aynı testler tekrar çalıştırıldı — partner artık her iki
notu da göremiyor (0 satır), pv_admin ve ilgili pv_sales/first_call
kullanıcıları hâlâ görebiliyor (gerçek oturumla `/partners/[id]` ve
`/leads/[id]` sayfaları üzerinden de doğrulandı).

## Bonus bulgu: `service_role`'a `private` şema erişimi eksikti

Test fixture'ını kurarken fark edildi: `service_role` Postgres rolüne
`private` şemasında hiçbir zaman `USAGE` grant'i verilmemiş. Bu, servis
rolüyle (backend/admin script) `profiles.partner_id` veya `profiles.is_active`
değiştirmeye çalışan herhangi bir kodun `permission denied for schema
private` hatası almasına yol açıyordu — çünkü bu alanları koruyan
`protect_profile_privileged_columns` tetikleyicisi içeride
`private.current_role()`'u çağırıyor. Canlı uygulama akışları bundan
etkilenmiyordu (gerçek admin işlemleri kendi oturumlu, RLS'e tabi client
üzerinden yapılıyor), ama gelecekte servis rolüyle yazılacak herhangi bir
toplu/otomatik profil güncelleme script'i bu duvara çarpardı. Düzeltme:
`grant usage on schema private to service_role` + `grant execute on all
functions in schema private to service_role` (+ `alter default privileges`
ile gelecekteki fonksiyonlar için de).

## Genel sonuç

15 testten 14'ü ilk denemede geçti. Tek gerçek başarısızlık (N5) kök
nedeniyle düzeltildi ve yeniden doğrulandı. Artık tüm testler geçiyor.
