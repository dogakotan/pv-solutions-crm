# İlk Admin Bootstrap Prosedürü

Bu doküman, **yeni/boş bir Supabase projesinde** (örn. yeni bir production
ortamı kurulurken) ilk `pv_admin` hesabının nasıl oluşturulacağını anlatır.

## Neden özel bir prosedür gerekiyor?

Uygulamada kasıtlı olarak:

- Kendi kendine kayıt (signup) ekranı yok.
- Rol atama yalnızca `public.set_user_role` RPC'si ile yapılır ve bu RPC
  çağıranın zaten `pv_admin` olmasını şart koşar (`private.current_role()
  is distinct from 'pv_admin'` kontrolü).

Yani boş bir veritabanında **hiç kimse** `set_user_role`'ü çağıramaz —
çağırabilmek için zaten bir admin olmak gerekir. Bu döngüyü kırmak için
yalnızca ilk admin, tek seferlik olarak doğrudan SQL ile atanır. Bu, bir
eksiklik değil, bilinçli bir tasarım: uygulamanın hiçbir UI/API yolu kendi
kendine admin olmaya izin vermemeli.

## Ön koşullar

- Tüm migration'lar uygulanmış olmalı (`supabase/migrations/`).
- `.env.local` (veya production ortam değişkenleri) `NEXT_PUBLIC_SUPABASE_URL`
  ve `NEXT_PUBLIC_SUPABASE_ANON_KEY` içermeli.

## Adım 1 — İlk admin için bir Auth hesabı oluştur

Supabase Dashboard → **Authentication → Users → Add User**:

- E-posta ve şifre gir.
- **Auto Confirm User** kutucuğunu işaretle (e-posta doğrulama beklemeden
  giriş yapabilsin).
- Oluşturduktan sonra kullanıcının **User UID**'sini (uuid) kopyala.

`on_auth_user_created` trigger'ı bu adımda otomatik olarak `public.profiles`
satırını oluşturur (`full_name`, `email`) — ayrıca bir şey yapmana gerek yok.

## Adım 2 — pv_admin rolünü doğrudan SQL ile ata

Supabase Dashboard → **SQL Editor**'da (bu, `postgres` rolüyle çalışır ve
RLS'i bypass eder — tam olarak bunun için kullanılıyor):

```sql
insert into public.user_role_assignments (user_id, role)
values ('<adım-1deki-user-uid>', 'pv_admin');
```

## Adım 3 — Doğrula

- O hesapla `/login`'den giriş yap.
- `/dashboard` ve `/admin/users` sayfalarının açıldığını doğrula.
- `/admin/users`'dan başka bir kullanıcıya rol atamayı dene (artık
  `set_user_role` RPC'si normal şekilde çalışır, çünkü caller artık gerçek
  bir `pv_admin`).

## Bundan sonrası

Bu manuel SQL adımı **yalnızca bu ilk bootstrap için** kullanılır. Bundan
sonraki her rol ataması (yeni admin, first_call, sales dahil) uygulamanın
kendi `/admin/users` ekranı üzerinden, `set_user_role` RPC'siyle yapılmalı
— bu RPC her atamayı `audit_logs`'a yazar, doğrudan SQL ise yazmaz.

Partner çalışanı hesapları (`partner_admin`/`partner_employee`) için bu
prosedüre gerek yok — bunlar partner detay sayfasındaki "Çalışanlar"
sekmesinden, uygulama içinden (Auth Admin API ile) oluşturulur.
