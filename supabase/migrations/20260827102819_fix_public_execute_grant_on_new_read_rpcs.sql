-- 27.08 tarihli 6 batch'lik "sorguları RPC'ye taşı" işinde eklenen 17
-- fonksiyonun her biri sadece "revoke all ... from anon" içeriyordu.
-- Postgres yeni fonksiyonlara varsayılan olarak PUBLIC'e EXECUTE veriyor;
-- "from anon" revoke'u bu PUBLIC grant'i etkilemiyor, dolayısıyla anon
-- (oturumsuz) rolü hâlâ has_function_privilege üzerinden EXECUTE
-- yetkisine sahip kalıyordu (pg_proc.proacl'da "=X/postgres" girdisi).
--
-- Gerçek bir veri sızıntısı DEĞİL: hepsi SECURITY INVOKER, altındaki
-- leads/partners/offers/partner_referrals tablolarının RLS politikaları
-- private.current_role()/auth.uid() üzerinden çalışıyor ve oturumsuz
-- istekte bu daima false dönüp sıfır satır veriyor (doğrulandı). Yine de
-- projenin yerleşik kuralıyla (bkz. revoke_anon_execute_on_rpcs.sql)
-- tutarsız ve savunma derinliği eksik — "from public" ile kapatılıyor.
revoke execute on function public.get_admin_lead_kpis() from public;
revoke execute on function public.get_first_call_lead_kpis(timestamptz, timestamptz) from public;
revoke execute on function public.get_sales_lead_kpis(timestamptz, timestamptz) from public;
revoke execute on function public.get_partner_referral_kpis() from public;
revoke execute on function public.get_action_items(integer) from public;
revoke execute on function public.get_partners_with_stats(uuid) from public;
revoke execute on function public.get_recommended_partners_for_lead(text, text) from public;
revoke execute on function public.get_lead_funnel(text, text) from public;
revoke execute on function public.get_source_conversion(text, text) from public;
revoke execute on function public.get_salesperson_performance(text, text) from public;
revoke execute on function public.get_partner_performance(text, text) from public;
revoke execute on function public.get_lost_reasons(text, text) from public;
revoke execute on function public.get_monthly_won_amount(text, text) from public;
revoke execute on function public.get_leads_needing_partner_assignment(integer) from public;
revoke execute on function public.get_offers_overview(integer) from public;
revoke execute on function public.get_offers_for_partner(uuid) from public;
revoke execute on function public.get_offer_history_for_lead(uuid) from public;

grant execute on function public.get_admin_lead_kpis() to authenticated;
grant execute on function public.get_first_call_lead_kpis(timestamptz, timestamptz) to authenticated;
grant execute on function public.get_sales_lead_kpis(timestamptz, timestamptz) to authenticated;
grant execute on function public.get_partner_referral_kpis() to authenticated;
grant execute on function public.get_action_items(integer) to authenticated;
grant execute on function public.get_partners_with_stats(uuid) to authenticated;
grant execute on function public.get_recommended_partners_for_lead(text, text) to authenticated;
grant execute on function public.get_lead_funnel(text, text) to authenticated;
grant execute on function public.get_source_conversion(text, text) to authenticated;
grant execute on function public.get_salesperson_performance(text, text) to authenticated;
grant execute on function public.get_partner_performance(text, text) to authenticated;
grant execute on function public.get_lost_reasons(text, text) to authenticated;
grant execute on function public.get_monthly_won_amount(text, text) to authenticated;
grant execute on function public.get_leads_needing_partner_assignment(integer) to authenticated;
grant execute on function public.get_offers_overview(integer) to authenticated;
grant execute on function public.get_offers_for_partner(uuid) to authenticated;
grant execute on function public.get_offer_history_for_lead(uuid) to authenticated;
