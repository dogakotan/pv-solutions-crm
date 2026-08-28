-- Meta Lead Ads webhook'unun retry'larında aynı lead'in iki kez
-- oluşturulmaması için: leadgen_id burada saklanır, unique partial
-- index tekrar geleni engeller (idempotency_keys'in ruhuna benzer,
-- ama tek kolonla, yalnızca dış kaynaklı leadler için).
alter table public.leads add column external_ref text;

create unique index leads_external_ref_idx on public.leads(external_ref) where external_ref is not null;
