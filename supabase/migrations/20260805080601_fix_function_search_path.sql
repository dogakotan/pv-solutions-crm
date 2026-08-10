-- Faz 1a düzeltmesi: security advisor "function_search_path_mutable" uyarısı.
-- private.current_role() ve private.sync_profile_from_auth_user() zaten
-- `set search_path = public` ile oluşturulmuştu; aşağıdaki iki fonksiyonda
-- bu eksikti.

alter function private.set_updated_at() set search_path = public;
alter function private.protect_profile_privileged_columns() set search_path = public;
