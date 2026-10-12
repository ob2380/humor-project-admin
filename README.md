# Laugh Track — Humor Project admin

Week 6 admin area for The Humor Project (COMS6998). Next.js 16, Tailwind 4, Supabase.

## What it does

| Page | Data | Access |
| --- | --- | --- |
| `/` Overview | Stats: caption scatter (votes vs approval), Wilson-ranked best/worst, most divisive, votes per day, weekday × hour heatmap, approval by caption length and by model, toughest/easiest voters. Toggle to hide demo rows. | Read |
| `/captions` | AI-generated captions with vote split | Create, read, update, delete |
| `/media` and `/media/[id]` | AI-generated images (files in Storage bucket `media`, URL in `images`) and their captions | Create, read, update, delete |
| `/votes` | Every upvote/downvote, filterable by direction, voter and caption | Read |
| `/users` and `/users/[id]` | Profiles, voting history, "agrees with the room" rate | Read |

## Security

Two layers, both required:

1. **App:** `src/proxy.ts` sends anyone without a Supabase session to `/login` (Google OAuth, redirect URI `/auth/callback`). Every admin page and server action calls `requireAdmin()` (`src/lib/auth.ts`), which redirects to `/denied` unless `profiles.is_superadmin = true`.
2. **Database:** RLS is on for every table. Admin reads/writes go through `public.is_superadmin()`. Users can't grant themselves admin because `authenticated` only has column-level UPDATE on name/avatar, not on `is_superadmin`.

## "Won't you be locked out?"

The first admin is bootstrapped outside the app. The Supabase SQL Editor (or MCP / CLI) runs as the `postgres` role, which isn't subject to RLS or the column grants, so it can flip the flag directly after you've signed in once with Google (the `on_auth_user_created` trigger creates your profile row):

```sql
update public.profiles set is_superadmin = true
where id = (select id from auth.users where email = 'ob2380@columbia.edu');
```

## Setup

1. Run `supabase/migrations/20261012_week6_admin.sql` in the Supabase SQL Editor.
2. Optional: run `supabase/seed/20261012_demo_data.sql` for demo voters, images, captions and votes (all marked `is_seed`; the cleanup SQL is at the bottom of that file).
3. Env vars (Vercel and `.env.local`):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
4. Supabase → Authentication → URL Configuration → Redirect URLs: add `https://<your-admin-domain>/auth/callback`.

```bash
npm install
npm run dev
```
