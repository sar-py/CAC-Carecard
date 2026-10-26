-- Independent private journals without email accounts.
create or replace function carecard_private.device_id() returns text
language sql stable security invoker set search_path='' as $$
 select case when coalesce(current_setting('request.headers',true),'{}')::jsonb->>'x-carecard-device' ~ '^[a-f0-9]{64}$'
 then coalesce(current_setting('request.headers',true),'{}')::jsonb->>'x-carecard-device' else null end;
$$;
grant usage on schema carecard_private to anon,authenticated;
revoke all on function carecard_private.device_id() from public;
grant execute on function carecard_private.device_id() to anon,authenticated;
create table public.carecard_device_entries(
 device_id text not null check(device_id ~ '^[a-f0-9]{64}$'),
 id uuid not null,recorded_at timestamptz not null,payload jsonb not null,
 primary key(device_id,id),
 check(jsonb_typeof(payload)='object'),check((payload->>'id')::uuid=id),
 check(octet_length(payload::text)<=750000)
);
alter table public.carecard_device_entries enable row level security;
alter table public.carecard_device_entries force row level security;
grant select,insert,update,delete on public.carecard_device_entries to anon,authenticated;
create policy private_device_select on public.carecard_device_entries for select to anon,authenticated using(device_id=(select carecard_private.device_id()));
create policy private_device_insert on public.carecard_device_entries for insert to anon,authenticated with check(device_id=(select carecard_private.device_id()));
create policy private_device_update on public.carecard_device_entries for update to anon,authenticated using(device_id=(select carecard_private.device_id())) with check(device_id=(select carecard_private.device_id()));
create policy private_device_delete on public.carecard_device_entries for delete to anon,authenticated using(device_id=(select carecard_private.device_id()));
create index private_device_recent on public.carecard_device_entries(device_id,recorded_at desc);
create table carecard_private.device_ai_budget(device_id text primary key,window_start timestamptz not null,used integer not null);
create table carecard_private.global_ai_budget(day date primary key,used integer not null);
alter table carecard_private.device_ai_budget enable row level security;
alter table carecard_private.global_ai_budget enable row level security;
revoke all on carecard_private.device_ai_budget,carecard_private.global_ai_budget from public,anon,authenticated;
create or replace function carecard_private.take_device_ai_slot() returns boolean
language plpgsql security definer set search_path='' as $$
declare who text:=carecard_private.device_id(); device_used integer; total_used integer;
begin
 if who is null then return false; end if;
 insert into carecard_private.device_ai_budget as budget(device_id,window_start,used)
 values(who,date_trunc('minute',now()),1)
 on conflict(device_id) do update set
 used=case when budget.window_start=date_trunc('minute',now()) then budget.used+1 else 1 end,
 window_start=date_trunc('minute',now()) returning used into device_used;
 if device_used>30 then return false; end if;
 insert into carecard_private.global_ai_budget as total(day,used) values(current_date,1)
 on conflict(day) do update set used=total.used+1 returning used into total_used;
 return total_used<=200;
end; $$;
revoke all on function carecard_private.take_device_ai_slot() from public;
grant execute on function carecard_private.take_device_ai_slot() to anon,authenticated;
create or replace function public.carecard_take_device_ai_slot() returns boolean
language sql security invoker set search_path='' as $$select carecard_private.take_device_ai_slot();$$;
revoke all on function public.carecard_take_device_ai_slot() from public;
grant execute on function public.carecard_take_device_ai_slot() to anon,authenticated;
