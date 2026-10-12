-- Week 6: Admin Panel — superadmin flag, RLS on every table, AI media table + bucket
-- Run once in Supabase → SQL Editor (runs as postgres, so it can bootstrap the first admin).

-- 1. Admin flag + richer profiles
alter table public.profiles add column if not exists is_superadmin boolean not null default false;
alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists is_seed boolean not null default false;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, first_name, last_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'given_name', split_part(new.raw_user_meta_data->>'full_name', ' ', 1)),
    new.raw_user_meta_data->>'family_name',
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

update public.profiles p set
  email = u.email,
  first_name = coalesce(p.first_name, u.raw_user_meta_data->>'given_name', split_part(u.raw_user_meta_data->>'full_name', ' ', 1)),
  last_name  = coalesce(p.last_name,  u.raw_user_meta_data->>'family_name'),
  avatar_url = coalesce(p.avatar_url, u.raw_user_meta_data->>'avatar_url')
from auth.users u where u.id = p.id;

-- 2. Helper used by every admin policy (security definer so it can read profiles under RLS)
create or replace function public.is_superadmin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_superadmin from public.profiles where id = auth.uid()), false);
$$;
revoke all on function public.is_superadmin() from public;
grant execute on function public.is_superadmin() to anon, authenticated;

-- 3. Nobody can promote themselves through the API: only name/avatar are writable
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (first_name, last_name, avatar_url, updated_at) on public.profiles to authenticated;

-- 4. AI-generated media: images (files live in Storage, DB stores the URL) + captions linked to them
create table if not exists public.images (
  id bigint generated always as identity primary key,
  url text not null,
  storage_path text,
  description text,
  model text,
  prompt text,
  is_seed boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.captions add column if not exists image_id bigint references public.images(id) on delete cascade;
alter table public.captions add column if not exists model text;
alter table public.captions add column if not exists prompt text;
alter table public.captions add column if not exists is_seed boolean not null default false;
alter table public.captions add column if not exists updated_at timestamptz not null default now();

create index if not exists captions_image_id_idx on public.captions(image_id);
create index if not exists caption_votes_caption_id_idx on public.caption_votes(caption_id);
create index if not exists caption_votes_profile_id_idx on public.caption_votes(profile_id);
create index if not exists caption_votes_created_at_idx on public.caption_votes(created_at);

-- one vote per user per caption
alter table public.caption_votes drop constraint if exists caption_votes_one_per_user;
alter table public.caption_votes add constraint caption_votes_one_per_user unique (caption_id, profile_id);

-- 5. Row Level Security everywhere
alter table public.profiles      enable row level security;
alter table public.caption_votes enable row level security;
alter table public.images        enable row level security;
alter table public.captions      enable row level security;

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_superadmin());
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists votes_select on public.caption_votes;
create policy votes_select on public.caption_votes for select to authenticated
  using (profile_id = auth.uid() or public.is_superadmin());
drop policy if exists votes_insert_own on public.caption_votes;
create policy votes_insert_own on public.caption_votes for insert to authenticated
  with check (profile_id = auth.uid());
drop policy if exists votes_update_own on public.caption_votes;
create policy votes_update_own on public.caption_votes for update to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());
drop policy if exists votes_delete_own on public.caption_votes;
create policy votes_delete_own on public.caption_votes for delete to authenticated
  using (profile_id = auth.uid());

-- captions: public read stays (public app needs it); writes are admin-only
drop policy if exists captions_admin_insert on public.captions;
create policy captions_admin_insert on public.captions for insert to authenticated with check (public.is_superadmin());
drop policy if exists captions_admin_update on public.captions;
create policy captions_admin_update on public.captions for update to authenticated using (public.is_superadmin()) with check (public.is_superadmin());
drop policy if exists captions_admin_delete on public.captions;
create policy captions_admin_delete on public.captions for delete to authenticated using (public.is_superadmin());

drop policy if exists images_public_read on public.images;
create policy images_public_read on public.images for select using (true);
drop policy if exists images_admin_insert on public.images;
create policy images_admin_insert on public.images for insert to authenticated with check (public.is_superadmin());
drop policy if exists images_admin_update on public.images;
create policy images_admin_update on public.images for update to authenticated using (public.is_superadmin()) with check (public.is_superadmin());
drop policy if exists images_admin_delete on public.images;
create policy images_admin_delete on public.images for delete to authenticated using (public.is_superadmin());

-- 6. Storage bucket for AI media: public read, admin-only write
insert into storage.buckets (id, name, public) values ('media', 'media', true)
on conflict (id) do nothing;

drop policy if exists media_admin_insert on storage.objects;
create policy media_admin_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and public.is_superadmin());
drop policy if exists media_admin_update on storage.objects;
create policy media_admin_update on storage.objects for update to authenticated
  using (bucket_id = 'media' and public.is_superadmin());
drop policy if exists media_admin_delete on storage.objects;
create policy media_admin_delete on storage.objects for delete to authenticated
  using (bucket_id = 'media' and public.is_superadmin());

-- 7. Bootstrap the first admin (runs as postgres, outside the API, so RLS/grants don't apply)
--    This is the answer to "won't you be locked out?"
update public.profiles set is_superadmin = true
where id = (select id from auth.users where email = 'ob2380@columbia.edu');

-- 8. Deleting media cleans up after itself: image -> captions -> votes
alter table public.caption_votes drop constraint if exists caption_votes_caption_id_fkey;
alter table public.caption_votes add constraint caption_votes_caption_id_fkey
  foreign key (caption_id) references public.captions(id) on delete cascade;
