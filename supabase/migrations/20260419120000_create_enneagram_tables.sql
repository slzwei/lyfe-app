-- Enneagram candidate assessment tables, mirroring disc_responses / disc_results.
-- Used by lyfe-sg /candidate/enneagram-quiz flow.

create table if not exists public.enneagram_responses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  responses jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint enneagram_responses_user_id_key unique (user_id)
);

create table if not exists public.enneagram_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  scores jsonb not null,
  primary_type smallint not null check (primary_type between 1 and 9),
  wing_type smallint check (wing_type is null or wing_type between 1 and 9),
  total smallint not null default 0,
  results_email text,
  duration_seconds integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint enneagram_results_user_id_key unique (user_id)
);

alter table public.invitations
  add column if not exists enneagram_pdf_path text;

-- RLS
alter table public.enneagram_responses enable row level security;
alter table public.enneagram_results enable row level security;

drop policy if exists "Users can view own enneagram responses" on public.enneagram_responses;
drop policy if exists "Users can insert own enneagram responses" on public.enneagram_responses;
drop policy if exists "Users can update own enneagram responses" on public.enneagram_responses;

create policy "Users can view own enneagram responses"
  on public.enneagram_responses for select using (auth.uid() = user_id);
create policy "Users can insert own enneagram responses"
  on public.enneagram_responses for insert with check (auth.uid() = user_id);
create policy "Users can update own enneagram responses"
  on public.enneagram_responses for update using (auth.uid() = user_id);

drop policy if exists "Users can view own enneagram results" on public.enneagram_results;
drop policy if exists "Users can insert own enneagram results" on public.enneagram_results;
drop policy if exists "Users can update own enneagram results" on public.enneagram_results;

create policy "Users can view own enneagram results"
  on public.enneagram_results for select using (auth.uid() = user_id);
create policy "Users can insert own enneagram results"
  on public.enneagram_results for insert with check (auth.uid() = user_id);
create policy "Users can update own enneagram results"
  on public.enneagram_results for update using (auth.uid() = user_id);

-- updated_at maintenance (mirrors update_updated_at() used across project)
drop trigger if exists trg_enneagram_responses_updated_at on public.enneagram_responses;
create trigger trg_enneagram_responses_updated_at
  before update on public.enneagram_responses
  for each row execute function public.update_updated_at();

drop trigger if exists trg_enneagram_results_updated_at on public.enneagram_results;
create trigger trg_enneagram_results_updated_at
  before update on public.enneagram_results
  for each row execute function public.update_updated_at();

-- Realtime progress signal: bumps progress_signals so ATS dashboard refetches
drop trigger if exists trg_enneagram_responses_progress on public.enneagram_responses;
create trigger trg_enneagram_responses_progress
  after insert or update on public.enneagram_responses
  for each row execute function public.notify_progress_change();

drop trigger if exists trg_enneagram_results_progress on public.enneagram_results;
create trigger trg_enneagram_results_progress
  after insert or update on public.enneagram_results
  for each row execute function public.notify_progress_change();

-- Notify assigned manager + PA on completion (mirrors DISC)
create or replace function public.trigger_notify_enneagram_completed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_candidate record;
  v_type_label text;
begin
  select c.id, c.name, c.assigned_manager_id, c.created_by_id
  into v_candidate
  from candidate_profiles cp
  join candidates c on c.id = cp.candidate_id
  where cp.user_id = new.user_id;

  if v_candidate is null then
    return new;
  end if;

  v_type_label := 'Type ' || new.primary_type::text ||
    case when new.wing_type is not null then 'w' || new.wing_type::text else '' end;

  perform notify_insert(
    v_candidate.assigned_manager_id,
    'enneagram_completed',
    'Enneagram Quiz Completed',
    v_candidate.name || ' has completed their Enneagram assessment',
    jsonb_build_object(
      'route', '/(tabs)/candidates/' || v_candidate.id,
      'candidateId', v_candidate.id,
      'enneagramType', v_type_label
    )
  );

  if v_candidate.created_by_id is distinct from v_candidate.assigned_manager_id then
    perform notify_insert(
      v_candidate.created_by_id,
      'enneagram_completed',
      'Enneagram Quiz Completed',
      v_candidate.name || ' has completed their Enneagram assessment',
      jsonb_build_object(
        'route', '/(tabs)/pa/candidate/' || v_candidate.id,
        'candidateId', v_candidate.id,
        'enneagramType', v_type_label
      )
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_notify_enneagram_completed on public.enneagram_results;
create trigger trg_notify_enneagram_completed
  after insert on public.enneagram_results
  for each row execute function public.trigger_notify_enneagram_completed();
