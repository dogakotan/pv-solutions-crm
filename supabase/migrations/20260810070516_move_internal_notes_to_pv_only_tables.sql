-- Partner internal notes: separate table, admin-only (matches current app usage:
-- /partners/new and /partners/[id] both require requireRole(["admin"])).
create table public.partner_internal_notes (
  partner_id uuid primary key references public.partners(id) on delete cascade,
  note text,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);

alter table public.partner_internal_notes enable row level security;
revoke all on public.partner_internal_notes from anon;

create policy partner_internal_notes_select on public.partner_internal_notes
  for select using ((select private.current_role()) = 'pv_admin');

create policy partner_internal_notes_insert on public.partner_internal_notes
  for insert with check ((select private.current_role()) = 'pv_admin');

create policy partner_internal_notes_update on public.partner_internal_notes
  for update
  using ((select private.current_role()) = 'pv_admin')
  with check ((select private.current_role()) = 'pv_admin');

insert into public.partner_internal_notes (partner_id, note)
select id, internal_notes from public.partners where internal_notes is not null;

alter table public.partners drop column internal_notes;

-- Lead internal notes: separate table, visibility mirrors leads_select_pv exactly
-- (pv_admin sees all; pv_sales via owner_id/sales_user_id; first_call via
-- created_by/first_call_user_id) so a partner referred a lead can never see it,
-- and one pv_sales rep can't see another's lead notes via this side table either.
create table public.lead_internal_notes (
  lead_id uuid primary key references public.leads(id) on delete cascade,
  note text,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);

alter table public.lead_internal_notes enable row level security;
revoke all on public.lead_internal_notes from anon;

create policy lead_internal_notes_select on public.lead_internal_notes
  for select using (
    exists (
      select 1 from public.leads l
      where l.id = lead_internal_notes.lead_id
        and (
          (select private.current_role()) = 'pv_admin'
          or (
            l.deleted_at is null and (
              ((select private.current_role()) = 'pv_sales' and (l.owner_id = (select auth.uid()) or l.sales_user_id = (select auth.uid())))
              or ((select private.current_role()) = 'first_call' and (l.created_by = (select auth.uid()) or l.first_call_user_id = (select auth.uid())))
            )
          )
        )
    )
  );

create policy lead_internal_notes_insert on public.lead_internal_notes
  for insert with check (
    exists (
      select 1 from public.leads l
      where l.id = lead_internal_notes.lead_id
        and (
          (select private.current_role()) = 'pv_admin'
          or (
            l.deleted_at is null and (
              ((select private.current_role()) = 'pv_sales' and (l.owner_id = (select auth.uid()) or l.sales_user_id = (select auth.uid())))
              or ((select private.current_role()) = 'first_call' and (l.created_by = (select auth.uid()) or l.first_call_user_id = (select auth.uid())))
            )
          )
        )
    )
  );

create policy lead_internal_notes_update on public.lead_internal_notes
  for update
  using (
    exists (
      select 1 from public.leads l
      where l.id = lead_internal_notes.lead_id
        and (
          (select private.current_role()) = 'pv_admin'
          or (
            l.deleted_at is null and (
              ((select private.current_role()) = 'pv_sales' and (l.owner_id = (select auth.uid()) or l.sales_user_id = (select auth.uid())))
              or ((select private.current_role()) = 'first_call' and (l.created_by = (select auth.uid()) or l.first_call_user_id = (select auth.uid())))
            )
          )
        )
    )
  )
  with check (
    exists (
      select 1 from public.leads l
      where l.id = lead_internal_notes.lead_id
        and (
          (select private.current_role()) = 'pv_admin'
          or (
            l.deleted_at is null and (
              ((select private.current_role()) = 'pv_sales' and (l.owner_id = (select auth.uid()) or l.sales_user_id = (select auth.uid())))
              or ((select private.current_role()) = 'first_call' and (l.created_by = (select auth.uid()) or l.first_call_user_id = (select auth.uid())))
            )
          )
        )
    )
  );

insert into public.lead_internal_notes (lead_id, note)
select id, internal_notes from public.leads where internal_notes is not null;

alter table public.leads drop column internal_notes;
