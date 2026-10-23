-- Week 7: Domain Model
-- Adds the pipeline/config tables the admin area manages. Run once in Supabase → SQL Editor.
-- Everything here is admin-only: RLS on, every policy checks public.is_superadmin().
-- Existing tables (profiles, images, captions, caption_votes, community_posts) are NOT changed,
-- so the public app keeps working exactly as before.
--
-- Domain model
--   llm_providers 1──* llm_models
--   prompt_chains 1──* prompt_chain_steps *──1 llm_models
--   prompt_chains 1──1 prompt_chain_mix            (how many captions each chain produces per request)
--   profiles 1──* generation_requests *──1 images, *──1 prompt_chains
--   generation_requests 1──* llm_responses *──1 llm_models, *──0..1 prompt_chain_steps
--   term_types 1──* terms
--   generation_examples *──0..1 images             (few-shot examples fed to the prompts)
--   allowed_signup_domains, whitelisted_emails     (who may sign up)

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  new.modified_by = auth.uid();
  return new;
end;
$$;

-- ---------- Providers and models ----------
create table if not exists public.llm_providers (
  id smallint generated always as identity primary key,
  name text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles(id) on delete set null,
  modified_by uuid references public.profiles(id) on delete set null
);

create table if not exists public.llm_models (
  id smallint generated always as identity primary key,
  name text not null unique,
  llm_provider_id smallint not null references public.llm_providers(id) on delete cascade,
  provider_model_id text not null,
  is_temperature_supported boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles(id) on delete set null,
  modified_by uuid references public.profiles(id) on delete set null
);
create index if not exists llm_models_provider_idx on public.llm_models(llm_provider_id);

-- ---------- Prompt chains ----------
create table if not exists public.prompt_chains (
  id bigint generated always as identity primary key,
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]*$'),
  description text,
  is_pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles(id) on delete set null,
  modified_by uuid references public.profiles(id) on delete set null
);

create table if not exists public.prompt_chain_steps (
  id bigint generated always as identity primary key,
  prompt_chain_id bigint not null references public.prompt_chains(id) on delete cascade,
  step_order smallint not null check (step_order > 0),
  description text,
  step_type text not null check (step_type in ('describe_image', 'generate_captions', 'judge', 'rewrite')),
  input_type text not null check (input_type in ('image_and_text', 'text_only')),
  output_type text not null check (output_type in ('string', 'array')),
  llm_model_id smallint not null references public.llm_models(id) on delete restrict,
  llm_temperature numeric(3,2) check (llm_temperature between 0 and 2),
  system_prompt text,
  user_prompt text,
  is_hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles(id) on delete set null,
  modified_by uuid references public.profiles(id) on delete set null,
  unique (prompt_chain_id, step_order)
);
create index if not exists prompt_chain_steps_model_idx on public.prompt_chain_steps(llm_model_id);

-- one mix row per chain: how many captions that chain contributes to each generation request
create table if not exists public.prompt_chain_mix (
  id bigint generated always as identity primary key,
  prompt_chain_id bigint not null unique references public.prompt_chains(id) on delete cascade,
  caption_count smallint not null default 1 check (caption_count between 0 and 50),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles(id) on delete set null,
  modified_by uuid references public.profiles(id) on delete set null
);

-- ---------- Generation requests and LLM responses (read-only in the admin area) ----------
create table if not exists public.generation_requests (
  id bigint generated always as identity primary key,
  profile_id uuid references public.profiles(id) on delete set null,
  image_id bigint references public.images(id) on delete cascade,
  prompt_chain_id bigint references public.prompt_chains(id) on delete set null,
  status text not null default 'completed' check (status in ('pending', 'completed', 'failed')),
  is_seed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles(id) on delete set null,
  modified_by uuid references public.profiles(id) on delete set null
);
create index if not exists generation_requests_profile_idx on public.generation_requests(profile_id);
create index if not exists generation_requests_image_idx on public.generation_requests(image_id);
create index if not exists generation_requests_chain_idx on public.generation_requests(prompt_chain_id);

create table if not exists public.llm_responses (
  id uuid primary key default gen_random_uuid(),
  generation_request_id bigint not null references public.generation_requests(id) on delete cascade,
  prompt_chain_step_id bigint references public.prompt_chain_steps(id) on delete set null,
  llm_model_id smallint not null references public.llm_models(id) on delete restrict,
  system_prompt text,
  user_prompt text,
  llm_temperature numeric(3,2),
  response text,
  processing_time_seconds numeric(6,2),
  is_seed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles(id) on delete set null,
  modified_by uuid references public.profiles(id) on delete set null
);
create index if not exists llm_responses_request_idx on public.llm_responses(generation_request_id);
create index if not exists llm_responses_model_idx on public.llm_responses(llm_model_id);
create index if not exists llm_responses_step_idx on public.llm_responses(prompt_chain_step_id);

-- ---------- Terms ----------
create table if not exists public.term_types (
  id smallint generated always as identity primary key,
  name text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles(id) on delete set null,
  modified_by uuid references public.profiles(id) on delete set null
);

create table if not exists public.terms (
  id bigint generated always as identity primary key,
  term text not null,
  definition text not null,
  example text,
  priority smallint not null default 0,
  term_type_id smallint references public.term_types(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles(id) on delete set null,
  modified_by uuid references public.profiles(id) on delete set null
);
create unique index if not exists terms_term_lower_idx on public.terms (lower(term));
create index if not exists terms_type_idx on public.terms(term_type_id);

-- ---------- Generation examples (few-shot examples) ----------
create table if not exists public.generation_examples (
  id bigint generated always as identity primary key,
  image_description text not null,
  caption text not null,
  explanation text,
  priority smallint not null default 0,
  image_id bigint references public.images(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles(id) on delete set null,
  modified_by uuid references public.profiles(id) on delete set null
);
create index if not exists generation_examples_image_idx on public.generation_examples(image_id);

-- ---------- Signup allow-lists ----------
create table if not exists public.allowed_signup_domains (
  id bigint generated always as identity primary key,
  apex_domain text not null check (apex_domain = lower(apex_domain) and apex_domain ~ '^[a-z0-9-]+(\.[a-z0-9-]+)+$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles(id) on delete set null,
  modified_by uuid references public.profiles(id) on delete set null,
  unique (apex_domain)
);

create table if not exists public.whitelisted_emails (
  id bigint generated always as identity primary key,
  email_address text not null check (email_address = lower(email_address) and email_address ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles(id) on delete set null,
  modified_by uuid references public.profiles(id) on delete set null,
  unique (email_address)
);

-- ---------- updated_at / modified_by triggers ----------
do $$
declare t text;
begin
  foreach t in array array[
    'llm_providers','llm_models','prompt_chains','prompt_chain_steps','prompt_chain_mix',
    'generation_requests','llm_responses','term_types','terms','generation_examples',
    'allowed_signup_domains','whitelisted_emails'
  ] loop
    execute format('drop trigger if exists %I on public.%I', t || '_touch', t);
    execute format('create trigger %I before update on public.%I for each row execute function public.touch_updated_at()', t || '_touch', t);
  end loop;
end $$;

-- ---------- Row Level Security: superadmin only ----------
do $$
declare t text;
begin
  foreach t in array array[
    'llm_providers','llm_models','prompt_chains','prompt_chain_steps','prompt_chain_mix',
    'generation_requests','llm_responses','term_types','terms','generation_examples',
    'allowed_signup_domains','whitelisted_emails'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('drop policy if exists %I on public.%I', t || '_admin_all', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.is_superadmin()) with check (public.is_superadmin())',
      t || '_admin_all', t
    );
  end loop;
end $$;

-- ---------- Seed: real configuration (providers, models, chains, terms, allow-lists) ----------
insert into public.llm_providers (name) values ('Google'), ('OpenAI'), ('Anthropic')
on conflict (name) do nothing;

insert into public.llm_models (name, llm_provider_id, provider_model_id, is_temperature_supported)
select v.name, p.id, v.provider_model_id, v.temp
from (values
  ('gemini-2.5-flash', 'Google',    'gemini-2.5-flash',  true),
  ('imagen-4',         'Google',    'imagen-4.0-generate-001', false),
  ('gpt-4.1-mini',     'OpenAI',    'gpt-4.1-mini',      true),
  ('dall-e-3',         'OpenAI',    'dall-e-3',          false),
  ('claude-haiku-4-5', 'Anthropic', 'claude-haiku-4-5',  true)
) as v(name, provider, provider_model_id, temp)
join public.llm_providers p on p.name = v.provider
on conflict (name) do nothing;

insert into public.prompt_chains (slug, description, is_pinned) values
  ('look-write-judge', 'Describe the image, write several caption candidates, then have a judge pick the funniest.', true),
  ('deadpan-two-step', 'Describe the image, then write one dry, understated caption.', false),
  ('columbia-lore', 'Write captions that lean on Columbia student culture and insider references.', false)
on conflict (slug) do nothing;

insert into public.prompt_chain_steps
  (prompt_chain_id, step_order, description, step_type, input_type, output_type, llm_model_id, llm_temperature, system_prompt, user_prompt)
select c.id, s.step_order, s.description, s.step_type, s.input_type, s.output_type, m.id, s.temp, s.system_prompt, s.user_prompt
from (values
  ('look-write-judge', 1, 'Describe what is in the image', 'describe_image', 'image_and_text', 'string', 'gemini-2.5-flash', 0.2,
    'You describe images factually and in detail. No jokes.', 'Describe the people, objects, setting and mood in this image.'),
  ('look-write-judge', 2, 'Write five caption candidates', 'generate_captions', 'text_only', 'array', 'gemini-2.5-flash', 1.1,
    'You write short, funny meme captions. One line each. Return a JSON array of strings.', 'Image description: {{step_1_output}}. Write five different captions.'),
  ('look-write-judge', 3, 'Pick the funniest', 'judge', 'text_only', 'string', 'gemini-2.5-flash', 0.0,
    'You are a tough comedy judge. Return only the single funniest caption, unchanged.', 'Candidates: {{step_2_output}}'),
  ('deadpan-two-step', 1, 'Describe what is in the image', 'describe_image', 'image_and_text', 'string', 'gpt-4.1-mini', 0.2,
    'You describe images factually and in detail. No jokes.', 'Describe this image.'),
  ('deadpan-two-step', 2, 'One dry caption', 'generate_captions', 'text_only', 'string', 'gpt-4.1-mini', 0.8,
    'You write deadpan, understated captions. One line, no exclamation marks.', 'Image description: {{step_1_output}}. Write one caption.'),
  ('columbia-lore', 1, 'Write Columbia-flavored captions', 'generate_captions', 'image_and_text', 'array', 'claude-haiku-4-5', 1.0,
    'You write captions that rely on Columbia student culture: Butler at 2am, the Core, Low Steps. Keep each under 100 characters. Return a JSON array.',
    'Write three captions for this image.')
) as s(chain, step_order, description, step_type, input_type, output_type, model, temp, system_prompt, user_prompt)
join public.prompt_chains c on c.slug = s.chain
join public.llm_models m on m.name = s.model
on conflict (prompt_chain_id, step_order) do nothing;

insert into public.prompt_chain_mix (prompt_chain_id, caption_count)
select c.id, v.n from (values ('look-write-judge', 3), ('deadpan-two-step', 2), ('columbia-lore', 1)) v(slug, n)
join public.prompt_chains c on c.slug = v.slug
on conflict (prompt_chain_id) do nothing;

insert into public.term_types (name) values ('Comedy technique'), ('Internet slang'), ('Columbia lore')
on conflict (name) do nothing;

insert into public.terms (term, definition, example, priority, term_type_id)
select v.term, v.definition, v.example, v.priority, t.id
from (values
  ('Callback', 'A joke that refers back to an earlier joke or detail.', 'Mentioning the "meeting that could have been an email" again in the last line.', 5, 'Comedy technique'),
  ('Deadpan', 'Delivering something absurd in a flat, serious tone.', 'Caption: "The dog has reviewed your spreadsheet."', 4, 'Comedy technique'),
  ('Rule of three', 'Two normal items, then a surprising third.', 'Coffee, deadlines, and a quiet sense of dread.', 3, 'Comedy technique'),
  ('Non sequitur', 'A line that does not follow from what came before, for surprise.', 'Image of a cat: "Anyway, the merger closes Tuesday."', 2, 'Comedy technique'),
  ('POV', 'Caption written from the point of view of someone or something in the image.', 'POV: you said "one more episode."', 4, 'Internet slang'),
  ('Butler at 2am', 'Shorthand for the late-night, caffeine-fueled study session at Butler Library.', 'Me at Butler at 2am, rereading the same paragraph.', 5, 'Columbia lore'),
  ('The Core', 'Columbia''s required undergraduate curriculum, a common source of shared complaints and jokes.', 'Reading the whole of Paradise Lost for Lit Hum.', 3, 'Columbia lore')
) as v(term, definition, example, priority, type_name)
join public.term_types t on t.name = v.type_name
on conflict do nothing;

insert into public.allowed_signup_domains (apex_domain) values ('columbia.edu'), ('barnard.edu')
on conflict (apex_domain) do nothing;

insert into public.whitelisted_emails (email_address) values ('ob2380@columbia.edu')
on conflict (email_address) do nothing;

insert into public.generation_examples (image_description, caption, explanation, priority, image_id)
select v.image_description, v.caption, v.explanation, v.priority, (select id from public.images order by id limit 1 offset v.img_offset)
from (values
  ('A cat staring at a laptop', 'It has seen your browser history.', 'Deadpan: gives the animal quiet authority over a human problem.', 5, 0),
  ('A crowded library table covered in coffee cups', 'Butler at 2am: a love story.', 'Insider reference plus an overdramatic framing.', 4, 1),
  ('A man pointing at a whiteboard', 'Per my last email.', 'Corporate phrase read as a threat.', 3, 2),
  ('A dog wearing sunglasses', 'Finals are over. I am free.', 'Mismatch between a cool image and a relatable feeling.', 2, null)
) as v(image_description, caption, explanation, priority, img_offset)
where not exists (select 1 from public.generation_examples);

-- ---------- Seed: demo generation requests and LLM responses (flagged is_seed) ----------
do $$
declare
  cap record;
  chain record;
  req_id bigint;
  voter uuid;
  voters uuid[];
  step record;
  n int := 0;
begin
  if exists (select 1 from public.generation_requests where is_seed) then return; end if;
  select array_agg(id) into voters from public.profiles where is_seed;

  for cap in
    select c.id, c.caption_text, c.image_id, c.model
    from public.captions c
    where c.is_seed and c.image_id is not null
    order by c.id limit 12
  loop
    n := n + 1;
    select * into chain from public.prompt_chains order by id offset (n % 3) limit 1;
    voter := case when voters is null then null else voters[1 + (n % array_length(voters, 1))] end;

    insert into public.generation_requests (profile_id, image_id, prompt_chain_id, status, is_seed, created_at)
    values (voter, cap.image_id, chain.id, case when n % 11 = 0 then 'failed' else 'completed' end, true, now() - (n || ' hours')::interval)
    returning id into req_id;

    for step in select * from public.prompt_chain_steps where prompt_chain_id = chain.id order by step_order loop
      insert into public.llm_responses
        (generation_request_id, prompt_chain_step_id, llm_model_id, system_prompt, user_prompt, llm_temperature, response, processing_time_seconds, is_seed, created_at)
      values (
        req_id, step.id, step.llm_model_id, step.system_prompt, step.user_prompt, step.llm_temperature,
        case
          when step.step_type = 'describe_image' then 'A scene from the image, described in neutral detail.'
          else cap.caption_text
        end,
        round((0.6 + random() * 3)::numeric, 2), true, now() - (n || ' hours')::interval
      );
    end loop;
  end loop;
end $$;
