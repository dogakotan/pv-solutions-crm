# Yedekleme ve Veri Dışa Aktarma Planı

## Mevcut durum (önemli)

Supabase organizasyonu şu an **Free plan**'da (`dogabkotan@gmail.com's Org`).
Free plan'da Supabase'in **otomatik günlük yedeklemesi yoktur** — bu, gerçek
müşteri/lead verisi taşıyan bir CRM için önemli bir risktir. Bir migration
hatası, yanlışlıkla çalıştırılan bir `delete`/`update`, veya proje düzeyinde
bir sorun durumunda geri dönecek bir Supabase yedeği bulunmaz.

**Öneri**: Production'a gerçek müşteri verisi girmeden önce Supabase
organizasyonunu **Pro plan**'a yükseltin. Pro plan günlük yedeklemeyi
(7 gün saklama) otomatik olarak sağlar; Point-in-Time Recovery (PITR) ayrı
bir ek pakettir. Bu, kod değişikliği gerektirmez — Dashboard → Organization
Settings → Billing üzerinden yapılır.

## Yükseltmeden önce/bağımsız olarak: manuel yedek alma

Supabase CLI, ek kurulum gerektirmeden `npx` ile çalıştırılabilir (bu
makinede doğrulandı — `npx supabase --version` → 2.112.0).

Manuel bir yedek almak için proje veritabanı şifresi gerekir (Dashboard →
Project Settings → Database → Connection string / Database password — bu
bende yok ve olmamalı, yalnızca proje sahibinde olmalı):

```bash
# Proje kökünde:
npx supabase db dump --db-url "postgresql://postgres:<DB_ŞİFRESİ>@db.mzwxtfnmikgcrmjgkvad.supabase.co:5432/postgres" -f backups/backup-$(date +%Y%m%d-%H%M%S).sql
```

Öneriler:

- `backups/` klasörünü `.gitignore`'a ekleyin — yedekler asla git'e
  commitlenmemeli (müşteri verisi + potansiyel olarak hassas alanlar
  içerir).
- Her **riskli migration'dan önce** (kolon silme, veri dönüştürme) manuel
  bir yedek alma alışkanlığı edinin.
- Yedeği düzenli (haftalık/aylık) bir harici konuma (yerel disk + bulut
  depolama) kopyalayın — Supabase'in kendi altyapısına bağımlı tek bir
  kopya yeterli değildir.

## Uygulama içi veri dışa aktarma

Orijinal sistem dokümanı (bölüm 13.3) lead listesinde "yetkiye göre dışa
aktarma" (CSV/Excel export) özelliğinden bahsediyor — **bu özellik henüz
uygulamada yok**. Şu an tek dışa aktarma yolu yukarıdaki `pg_dump` tabanlı
tam veritabanı yedeğidir. Satır bazlı/filtrelenmiş CSV export'u ayrı bir
UI özelliği olarak (gerekirse) ileride eklenebilir — bu, bir sonraki
somut talep geldiğinde ayrı bir iş olarak ele alınmalı.

## Restore prosedürü

Supabase Dashboard üzerinden yedekten geri yükleme (Pro plan'a
yükseltildiğinde): Dashboard → Database → Backups → ilgili tarih → Restore.
Manuel `pg_dump` yedeğinden geri yükleme:

```bash
psql "postgresql://postgres:<DB_ŞİFRESİ>@db.mzwxtfnmikgcrmjgkvad.supabase.co:5432/postgres" -f backups/backup-<tarih>.sql
```

Restore, mevcut veriyi geri alınamaz şekilde değiştirir — önce mutlaka
güncel bir yedek alınmalı ve mümkünse önce bir Supabase branch/staging
ortamında denenmelidir.
