-- Pre-authorize admins by email, so someone who has never signed in can be granted access.
-- On their first Google sign-in, handle_new_user() creates the profile with is_superadmin = true.
-- The table has RLS on and no policies: only the postgres role (SQL Editor) can read or change it.

create table if not exists public.admin_invites (
  email text primary key check (email = lower(email)),
  invited_at timestamptz not null default now(),
  note text
);
alter table public.admin_invites enable row level security;
revoke all on public.admin_invites from anon, authenticated;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, first_name, last_name, avatar_url, is_superadmin)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'given_name', split_part(new.raw_user_meta_data->>'full_name', ' ', 1)),
    new.raw_user_meta_data->>'family_name',
    new.raw_user_meta_data->>'avatar_url',
    exists (select 1 from public.admin_invites i where i.email = lower(new.email))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

insert into public.admin_invites (email, note)
values ('gcn2106@columbia.edu', 'Granted admin-panel access on request, Oct 20 2026')
on conflict (email) do nothing;

-- If they had already signed in, grant it now as well.
update public.profiles p set is_superadmin = true
from auth.users u
where u.id = p.id and lower(u.email) in (select email from public.admin_invites);
