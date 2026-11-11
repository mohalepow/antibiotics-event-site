-- Idempotent game-score submission upgrade
-- Run once in Supabase SQL Editor AFTER supabase-upgrade-achievements.sql.
-- This prevents the same completed game round from being credited more than once.

create table if not exists public.game_score_submissions (
  run_id uuid primary key,
  created_at timestamptz not null default now()
);

alter table public.game_score_submissions enable row level security;

revoke all on table public.game_score_submissions from anon, authenticated;
-- No direct table access is required. The SECURITY DEFINER RPC owns writes.

create or replace function public.submit_game_score_once(
  p_run_id uuid,
  p_name text,
  p_score integer
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  inserted_rows integer;
begin
  if p_run_id is null then
    raise exception 'A game run ID is required';
  end if;

  if p_name is null or length(trim(p_name)) < 2 or length(trim(p_name)) > 18 then
    raise exception 'Player name must be between 2 and 18 characters';
  end if;

  if p_score is null or p_score < 1 or p_score > 100000 then
    raise exception 'Invalid game score';
  end if;

  insert into public.game_score_submissions(run_id)
  values (p_run_id)
  on conflict (run_id) do nothing;

  get diagnostics inserted_rows = row_count;

  if inserted_rows = 0 then
    return jsonb_build_object('already_submitted', true);
  end if;

  -- Preserve the existing leaderboard, points and achievement logic.
  perform public.submit_game_score(trim(p_name), p_score);

  return jsonb_build_object('already_submitted', false);
end;
$$;

revoke all on function public.submit_game_score_once(uuid, text, integer) from public;
grant execute on function public.submit_game_score_once(uuid, text, integer) to anon, authenticated;

comment on function public.submit_game_score_once(uuid, text, integer)
is 'Credits a completed game run once only, using a unique client run UUID.';
