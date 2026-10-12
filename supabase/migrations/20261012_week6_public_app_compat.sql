-- Week 6 follow-up: keep the public app working under RLS, and keep demo rows admin-only.
--
-- The public app scores its feed from every vote and shows first names on its leaderboard,
-- so votes and names must stay readable. Emails and admin flags are not exposed: they are
-- only reachable through admin_profiles(), which checks is_superadmin().

-- 1. Demo votes get their own flag so they can be hidden from the public app.
alter table public.caption_votes add column if not exists is_seed boolean not null default false;
update public.caption_votes v set is_seed = true
from public.profiles p where p.id = v.profile_id and p.is_seed and not v.is_seed;

-- 2. Captions and images: everyone reads real rows; demo rows only for admins.
drop policy if exists "Public read access" on public.captions;
drop policy if exists captions_read on public.captions;
create policy captions_read on public.captions for select using (not is_seed or public.is_superadmin());

drop policy if exists images_public_read on public.images;
drop policy if exists images_read on public.images;
create policy images_read on public.images for select using (not is_seed or public.is_superadmin());

-- 3. Votes: the public feed needs every real vote to compute scores. Writes stay own-row only.
drop policy if exists votes_select on public.caption_votes;
drop policy if exists votes_read on public.caption_votes;
create policy votes_read on public.caption_votes for select using (not is_seed or public.is_superadmin());

-- 4. Profiles: signed-in users can read names and avatars (leaderboard). Nothing else.
alter table public.profiles drop column if exists email;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, first_name, last_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'given_name', split_part(new.raw_user_meta_data->>'full_name', ' ', 1)),
    new.raw_user_meta_data->>'family_name',
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop policy if exists profiles_select on public.profiles;
drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated
  using (not is_seed or public.is_superadmin());

revoke select on public.profiles from anon, authenticated;
grant select (id, first_name, last_name, avatar_url, created_at, updated_at) on public.profiles to authenticated;

-- 5. Admin-only view of every profile, with the email from auth.users.
create or replace function public.admin_profiles()
returns table (
  id uuid, email text, first_name text, last_name text, avatar_url text,
  is_superadmin boolean, is_seed boolean, created_at timestamptz
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_superadmin() then
    raise exception 'superadmin only' using errcode = '42501';
  end if;
  return query
    select p.id, u.email::text, p.first_name, p.last_name, p.avatar_url, p.is_superadmin, p.is_seed, p.created_at
    from public.profiles p
    left join auth.users u on u.id = p.id
    order by p.created_at;
end;
$$;
revoke all on function public.admin_profiles() from public, anon;
grant execute on function public.admin_profiles() to authenticated;
