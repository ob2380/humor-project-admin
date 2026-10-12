-- Demo data for the Week 6 admin dashboard.
-- Every row this creates is marked is_seed = true (or uses an @seed.laughtrack.test email),
-- the dashboard can hide it with "Real activity only", and the block at the bottom removes it.
-- Run AFTER 20261012_week6_admin.sql and 20261012_week6_public_app_compat.sql.
-- Demo rows are visible only to superadmins (RLS), so they never reach the public app.

begin;
select setseed(0.42);

-- 1. 28 demo voters. They exist only so votes have owners: no password, no identity, can't sign in.
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  lower(fn || '.' || ln) || '@seed.laughtrack.test',
  '',
  '{"provider":"seed","providers":["seed"]}'::jsonb,
  jsonb_build_object('given_name', fn, 'family_name', ln, 'full_name', fn || ' ' || ln),
  now() - (random() * interval '40 days') - interval '20 days',
  now()
from unnest(
  array['Maya','Jonah','Priya','Leo','Ava','Marcus','Sofia','Ethan','Zara','Noah','Lena','Omar','Chloe','Ravi',
        'Isla','Theo','Nadia','Felix','Hana','Diego','Elena','Sam','Yuki','Ben','Amara','Kai','Tess','Ari'],
  array['Chen','Park','Shah','Rossi','Kim','Bell','Ortiz','Wong','Haddad','Fischer','Novak','Farah','Dubois','Iyer',
        'Grant','Moreau','Aziz','Klein','Sato','Ramos','Petrov','Lee','Tanaka','Cohen','Okafor','Nguyen','Walsh','Levi']
) as t(fn, ln)
on conflict do nothing;

update public.profiles set is_seed = true, created_at = u.created_at
from auth.users u
where u.id = profiles.id and u.email like '%@seed.laughtrack.test';

-- 2. Six AI-style illustrations (files ship in the admin app under /public/seed).
insert into public.images (url, description, model, prompt, is_seed, created_at)
values
  ('/seed/pigeon-steps.svg',    'A pigeon guarding the Low Library steps', 'dall-e-3', 'flat illustration, campus pigeon, territorial, Columbia steps', true, now() - interval '29 days'),
  ('/seed/dog-scarf.svg',       'A golden retriever in a Columbia-blue scarf on the lawn', 'dall-e-3', 'flat illustration, golden retriever, light blue scarf, college lawn', true, now() - interval '26 days'),
  ('/seed/butler-nap.svg',      'A student asleep on a stack of textbooks in Butler', 'imagen-4', 'flat illustration, student sleeping on books, library at night', true, now() - interval '22 days'),
  ('/seed/squirrel-coffee.svg', 'A squirrel holding an iced coffee on College Walk', 'imagen-4', 'flat illustration, squirrel with coffee cup, campus walkway', true, now() - interval '18 days'),
  ('/seed/cat-laptop.svg',      'A cat lying on a laptop during a video lecture', 'dall-e-3', 'flat illustration, orange cat on laptop keyboard, video call grid', true, now() - interval '13 days'),
  ('/seed/statue-umbrella.svg', 'A bronze campus statue holding a tiny umbrella in the rain', 'imagen-4', 'flat illustration, bronze statue, yellow umbrella, rain', true, now() - interval '8 days');

-- 3. Captions, each with a hidden "quality" that drives how the demo crowd votes.
create temporary table seed_captions (img_desc text, caption_text text, model text, flavor text, quality numeric) on commit drop;
insert into seed_captions values
  ('A pigeon guarding the Low Library steps', 'He has not paid tuition since 1897 and he never will.', 'claude-haiku-4-5', 'dry-columbia', 1.6),
  ('A pigeon guarding the Low Library steps', 'Office hours are by appointment. He does not take appointments.', 'gpt-4.1-mini', 'dry-columbia', 1.2),
  ('A pigeon guarding the Low Library steps', 'Pigeon on the steps.', 'gemini-2.5-flash', 'literal', -1.6),
  ('A pigeon guarding the Low Library steps', 'Core Curriculum, pigeon edition: everything is mine.', 'gpt-4.1-mini', 'absurdist', 0.4),
  ('A pigeon guarding the Low Library steps', 'When the TA says the midterm curve is "generous".', 'gemini-2.5-flash', 'relatable', 0.1),
  ('A golden retriever in a Columbia-blue scarf on the lawn', 'Applied early decision. Got in on vibes.', 'claude-haiku-4-5', 'wholesome', 1.4),
  ('A golden retriever in a Columbia-blue scarf on the lawn', 'Majoring in being a good boy, minoring in econ.', 'gpt-4.1-mini', 'wholesome', 1.0),
  ('A golden retriever in a Columbia-blue scarf on the lawn', 'This dog is happy.', 'gemini-2.5-flash', 'literal', -1.4),
  ('A golden retriever in a Columbia-blue scarf on the lawn', 'Roar, lion, roar. Woof, retriever, woof.', 'gpt-4.1-mini', 'school-spirit', 0.0),
  ('A golden retriever in a Columbia-blue scarf on the lawn', 'Only member of Columbia who has never once checked his GPA.', 'claude-haiku-4-5', 'dry-columbia', 0.9),
  ('A student asleep on a stack of textbooks in Butler', 'Butler at 3am: a love story with no happy ending.', 'claude-haiku-4-5', 'dry-columbia', 1.3),
  ('A student asleep on a stack of textbooks in Butler', 'Absorbing Kant through the forehead. It''s the only way it goes in.', 'gpt-4.1-mini', 'absurdist', 1.1),
  ('A student asleep on a stack of textbooks in Butler', 'Student is tired after studying a lot of books.', 'gemini-2.5-flash', 'literal', -1.8),
  ('A student asleep on a stack of textbooks in Butler', 'Me after reading one page of the Iliad.', 'gemini-2.5-flash', 'relatable', 0.3),
  ('A student asleep on a stack of textbooks in Butler', 'The 24-hour room is a lifestyle, not a location.', 'gpt-4.1-mini', 'dry-columbia', 0.7),
  ('A squirrel holding an iced coffee on College Walk', 'It is 38 degrees. The iced coffee is non-negotiable.', 'claude-haiku-4-5', 'relatable', 1.5),
  ('A squirrel holding an iced coffee on College Walk', 'Has three finals tomorrow and zero regrets.', 'gpt-4.1-mini', 'relatable', 0.2),
  ('A squirrel holding an iced coffee on College Walk', 'A squirrel that likes coffee very much.', 'gemini-2.5-flash', 'literal', -1.5),
  ('A squirrel holding an iced coffee on College Walk', 'Venture-backed nut hoarding. Pre-seed.', 'claude-haiku-4-5', 'absurdist', 0.6),
  ('A squirrel holding an iced coffee on College Walk', 'The real dean of College Walk.', 'gpt-4.1-mini', 'dry-columbia', 0.5),
  ('A cat lying on a laptop during a video lecture', 'Camera off, mic off, morals off.', 'claude-haiku-4-5', 'absurdist', 1.0),
  ('A cat lying on a laptop during a video lecture', 'Professor: any questions? Cat: sends 400 letter j''s to the chat.', 'gpt-4.1-mini', 'relatable', 1.2),
  ('A cat lying on a laptop during a video lecture', 'The cat is on the computer.', 'gemini-2.5-flash', 'literal', -1.7),
  ('A cat lying on a laptop during a video lecture', 'Attendance counts for 10% and he is here for all of it.', 'gemini-2.5-flash', 'dry-columbia', 0.4),
  ('A cat lying on a laptop during a video lecture', 'Remote learning pioneer since 2020.', 'gpt-4.1-mini', 'relatable', -0.2),
  ('A bronze campus statue holding a tiny umbrella in the rain', 'Has stood through every finals week since 1903. Today she draws the line.', 'claude-haiku-4-5', 'dry-columbia', 1.1),
  ('A bronze campus statue holding a tiny umbrella in the rain', 'Bronze is waterproof. Dignity is not.', 'gpt-4.1-mini', 'absurdist', 0.8),
  ('A bronze campus statue holding a tiny umbrella in the rain', 'A statue with an umbrella.', 'gemini-2.5-flash', 'literal', -1.5),
  ('A bronze campus statue holding a tiny umbrella in the rain', 'Find the owl. Then find a dry place to stand.', 'gpt-4.1-mini', 'school-spirit', 0.0),
  ('A bronze campus statue holding a tiny umbrella in the rain', 'Morningside Heights weather report: yes.', 'gemini-2.5-flash', 'relatable', 0.3);

insert into public.captions (caption_text, image_id, image_description, model, prompt, is_seed, created_at)
select s.caption_text, i.id, i.description, s.model,
       'flavor=' || s.flavor || '; write one short caption for: ' || i.description,
       true,
       i.created_at + (random() * interval '20 hours')
from seed_captions s join public.images i on i.description = s.img_desc and i.is_seed;

-- quality lookup for every caption the demo crowd will judge (existing captions get a neutral-ish score)
create temporary table seed_quality on commit drop as
select c.id as caption_id, c.created_at,
       coalesce(s.quality, case c.id % 5 when 0 then 0.9 when 1 then -0.3 when 2 then 0.4 when 3 then 1.2 else -0.8 end) as quality
from public.captions c
left join seed_captions s on s.caption_text = c.caption_text;

-- 4. Votes. Each voter has a leniency; each caption a quality. P(up) = sigmoid(quality + leniency).
--    Timestamps fall after the caption was posted and cluster in the evening and late night.
create temporary table seed_voters on commit drop as
select p.id as profile_id, (random() * 2.4 - 1.2) as leniency, (0.45 + random() * 0.45) as activity
from public.profiles p where p.is_seed;

insert into public.caption_votes (caption_id, profile_id, vote_value, created_at, is_seed)
select q.caption_id, v.profile_id,
       case when random() < 1 / (1 + exp(-(q.quality + v.leniency))) then 1 else -1 end,
       least(
         now() - interval '5 minutes',
         greatest(q.created_at + interval '10 minutes',
         date_trunc('day', q.created_at + (random() ^ 2) * (now() - q.created_at)) + interval '4 hours'
           + make_interval(hours => (array[9,11,12,13,14,15,16,17,18,19,20,20,21,21,22,22,22,23,23,0,0,1,1,2])[1 + floor(random() * 24)::int],
                           mins  => floor(random() * 60)::int))
       ),
       true
from seed_quality q
cross join seed_voters v
where random() < v.activity
on conflict (caption_id, profile_id) do nothing;

commit;

-- ---------------------------------------------------------------------------
-- To remove every demo row later, run:
--
-- delete from public.caption_votes where profile_id in (select id from public.profiles where is_seed);
-- delete from public.images where is_seed;            -- cascades to its captions and their votes
-- delete from public.profiles where is_seed;
-- delete from auth.users where email like '%@seed.laughtrack.test';
