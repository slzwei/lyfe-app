-- Signal table (always exactly one row)
create table if not exists progress_signals (
  id integer primary key default 1,
  updated_at timestamptz default now()
);

insert into progress_signals (id) values (1) on conflict do nothing;

-- RLS: anyone can read (needed for the anon-key Realtime subscription)
alter table progress_signals enable row level security;
create policy "Anyone can read signals" on progress_signals for select using (true);

-- Publish to Realtime
alter publication supabase_realtime add table progress_signals;

-- Trigger function: touch the signal row
create or replace function notify_progress_change()
returns trigger as $$
begin
  update progress_signals set updated_at = now() where id = 1;
  return coalesce(new, old);
end;
$$ language plpgsql security definer;

-- Fire on any candidate progress change
create trigger trg_profile_progress
  after insert or update on candidate_profiles
  for each row execute function notify_progress_change();

create trigger trg_responses_progress
  after insert or update on disc_responses
  for each row execute function notify_progress_change();

create trigger trg_results_progress
  after insert or update on disc_results
  for each row execute function notify_progress_change();

create trigger trg_invitations_progress
  after insert or update on invitations
  for each row execute function notify_progress_change();
