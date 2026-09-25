# PV Solutions CRM

PV Solutions CRM, güneş enerjisi projelerinde müşteri adaylarını, iş ortaklarını, teklifleri ve satış sonrası aktiviteleri takip etmek için geliştirilmiş web tabanlı bir CRM uygulamasıdır.

Uygulama Next.js App Router ve Supabase üzerine kuruludur. Giriş ve rol tabanlı erişim Supabase Auth ve veritabanı politikalarıyla yönetilir. Uygulamada kendi kendine kayıt akışı yoktur; ilk yönetici hesabı elle oluşturulur.

## Özellikler

- Müşteri adayları, atamalar, aktiviteler ve satış sonuçlarını takip etme
- İş ortaklarını ve iş ortağı kullanıcılarını yönetme
- Teklif ve teklif sürümlerini oluşturma, inceleme ve Excel olarak dışa aktarma
- Rol bazlı ekranlar ve yönetici işlemleri
- Denetim kayıtları ve bildirimler
- Meta ve Google Ads müşteri adayı webhook uçları

## Teknoloji yığını

- Next.js 16 ve React 19
- TypeScript
- Supabase Auth ve PostgreSQL
- Tailwind CSS
- Playwright ile uçtan uca testler

## Geliştirme ortamını hazırlama

Gereksinimler: Node.js ve npm.

1. Depoyu klonlayıp proje klasörüne geçin.

   ```bash
   git clone https://github.com/dogakotan/pv-solutions-crm.git
   cd pv-solutions-crm
   ```

2. Bağımlılıkları kurun.

   ```bash
   npm ci
   ```

3. Ortam dosyasını oluşturun.

   ```bash
   cp .env.example .env.local
   ```

   Windows PowerShell'de `Copy-Item .env.example .env.local` komutunu kullanabilirsiniz. `.env.local` içinde en az şu değerleri kendi Supabase projenize göre düzenleyin:

   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_SITE_URL` (yerel geliştirme için `http://localhost:3000`)

4. Veritabanı migration'larını `supabase/migrations/` dizininden Supabase projenize uygulayın. Supabase CLI kurulumu ve migration iş akışı için [Supabase CLI belgelerine](https://supabase.com/docs/guides/cli) bakın.

5. Geliştirme sunucusunu başlatın.

   ```bash
   npm run dev
   ```

   Uygulama [http://localhost:3000](http://localhost:3000) adresinde açılır.

## İlk yönetici hesabı

Uygulamada açık kayıt ve ilk yönetici oluşturma ekranı yoktur. Yeni veya boş bir Supabase ortamında ilk yönetici hesabını kurma adımları [`docs/ADMIN_BOOTSTRAP.md`](docs/ADMIN_BOOTSTRAP.md) belgesindedir. Bu işlemden sonraki kullanıcı ve rol yönetimi uygulamanın yönetici ekranından yapılır.

## Komutlar

| Komut | Açıklama |
| --- | --- |
| `npm run dev` | Yerel geliştirme sunucusunu başlatır. |
| `npm run build` | Üretim derlemesi oluşturur. |
| `npm run start` | Üretim sunucusunu başlatır. |
| `npm run lint` | ESLint kontrollerini çalıştırır. |
| `npm run test:e2e` | Playwright uçtan uca testlerini çalıştırır. |

Uçtan uca testler Supabase üzerinde test kullanıcıları ve temizlik işlemleri için servis rolü anahtarı gerektirebilir. Gerekli test değişkenlerinin adları ve açıklamaları `.env.example` içinde yer alır. Test hesabı bilgilerini Git'e eklemeyin.

## Proje yapısı

- `src/app/` — Sayfalar, layout'lar ve API uçları
- `src/components/` — Paylaşılan arayüz bileşenleri
- `src/lib/` — Kimlik doğrulama, Supabase erişimi ve iş mantığı
- `src/types/` — TypeScript türleri
- `supabase/migrations/` — Veritabanı şeması ve politika değişiklikleri
- `e2e/` — Playwright testleri
- `docs/` — Yönetim ve veritabanı süreçleri

## Güvenlik notları

- `.env.local` gibi gizli değer içeren ortam dosyalarını repoya eklemeyin. Bu dosyalar `.gitignore` ile dışarıda tutulur.
- `SUPABASE_SERVICE_ROLE_KEY` yalnızca sunucu tarafında kullanılmalıdır; `NEXT_PUBLIC_` önekiyle tanımlamayın ve tarayıcıya göndermeyin.
- Erişim kontrolleri ve veritabanı politikaları için değişiklikleri ilgili Supabase migration'larıyla birlikte değerlendirin.
