-- Run once in Supabase SQL Editor. No service-role key is used by the app.
create table if not exists public.carecard_entries (
 user_id uuid not null references auth.users(id) on delete cascade,
 id uuid not null,
 recorded_at timestamptz not null,
 payload jsonb not null,
 primary key (user_id,id),
 constraint payload_is_object check (jsonb_typeof(payload)='object'),
 constraint payload_id_matches check ((payload->>'id')::uuid=id),
 constraint payload_size check (octet_length(payload::text)<=750000)
);
alter table public.carecard_entries enable row level security;
alter table public.carecard_entries force row level security;
revoke all on public.carecard_entries from anon;
grant select,insert,update,delete on public.carecard_entries to authenticated;
create policy own_notes_select on public.carecard_entries for select to authenticated using ((select auth.uid())=user_id);
create policy own_notes_insert on public.carecard_entries for insert to authenticated with check ((select auth.uid())=user_id);
create policy own_notes_update on public.carecard_entries for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy own_notes_delete on public.carecard_entries for delete to authenticated using ((select auth.uid())=user_id);
create index if not exists carecard_entries_recent on public.carecard_entries(user_id,recorded_at desc);

-- Persistent per-account AI budget: works across Vercel instances.
create schema if not exists carecard_private;
revoke all on schema carecard_private from public,anon,authenticated;
create table if not exists carecard_private.ai_budget(user_id uuid primary key references auth.users(id) on delete cascade,window_start timestamptz not null,used integer not null);
create or replace function public.carecard_take_ai_slot() returns boolean
language plpgsql security definer set search_path='' as $$
declare who uuid:=auth.uid(); used_now integer;
begin
 if who is null then return false; end if;
 insert into carecard_private.ai_budget as budget(user_id,window_start,used)
 values(who,date_trunc('minute',now()),1)
 on conflict(user_id) do update set
 used=case when budget.window_start=date_trunc('minute',now()) then budget.used+1 else 1 end,
 window_start=date_trunc('minute',now())
 returning used into used_now;
 return used_now<=30;
end; $$;
revoke all on function public.carecard_take_ai_slot() from public,anon;
grant execute on function public.carecard_take_ai_slot() to authenticated;
