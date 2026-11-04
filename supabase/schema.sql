-- Aviv Mellick Aesthetics: consent form storage.
-- Run once in the Supabase SQL editor.
--
-- Access model:
--   public (anon key)  can INSERT a submission and nothing else: no read, update or delete.
--   approved admins    can SELECT submissions. Being logged in is not enough; the user
--                      must also be listed in public.admins.
--   nobody via the API can UPDATE or DELETE a signed form.

create table public.submissions (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  form_version text not null check (char_length(form_version) <= 20),
  data         jsonb not null check (
                 jsonb_typeof(data) = 'object'
                 and octet_length(data::text) < 2000000
               )
);

create index submissions_created_at_idx on public.submissions (created_at desc);

create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);

alter table public.submissions enable row level security;
alter table public.admins      enable row level security;

revoke all on public.submissions from public, anon, authenticated;
revoke all on public.admins      from public, anon, authenticated;

-- Column-level grant: clients cannot choose id or created_at, so the timestamp is the server's.
grant insert (form_version, data) on public.submissions to anon, authenticated;
grant select on public.submissions to authenticated;
grant select on public.admins      to authenticated;

create policy "anyone can submit a form"
  on public.submissions for insert
  to anon, authenticated
  with check (true);

create policy "admins can read forms"
  on public.submissions for select
  to authenticated
  using (exists (select 1 from public.admins a where a.user_id = auth.uid()));

create policy "users can see their own admin row"
  on public.admins for select
  to authenticated
  using (user_id = auth.uid());

-- Keeps the free-plan project awake. Reveals nothing; called weekly by .github/workflows/keepalive.yml.
create function public.ping() returns boolean
  language sql stable
  set search_path = ''
  as 'select true';
revoke all on function public.ping() from public;
grant execute on function public.ping() to anon;
