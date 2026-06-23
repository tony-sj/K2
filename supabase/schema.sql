create extension if not exists pgcrypto;
create extension if not exists btree_gist;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  name text not null,
  created_at timestamptz not null default now(),
  constraint profiles_school_email_check
    check (right(lower(email), length('@med.kku.ac.kr')) = '@med.kku.ac.kr')
);

create table if not exists public.facilities (
  id serial primary key,
  name text not null unique
);

create table if not exists public.reservations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  facility_id integer not null references public.facilities(id) on delete restrict,
  reservation_date date not null,
  start_time integer not null,
  end_time integer not null,
  reserved_by_name text not null default '',
  created_at timestamptz not null default now(),
  constraint reservations_start_time_check check (start_time between 0 and 23),
  constraint reservations_end_time_check check (end_time between 1 and 24),
  constraint reservations_time_order_check check (start_time < end_time),
  constraint reservations_no_overlap
    exclude using gist (
      facility_id with =,
      reservation_date with =,
      int4range(start_time, end_time, '[)') with &&
    )
);

alter table public.reservations
  add column if not exists reserved_by_name text not null default '';

alter table public.reservations
  drop constraint if exists reservations_facility_id_fkey;

alter table public.reservations
  add constraint reservations_facility_id_fkey
  foreign key (facility_id) references public.facilities(id) on delete restrict;

update public.reservations
set reserved_by_name = public.profiles.name
from public.profiles
where public.reservations.user_id = public.profiles.id
  and coalesce(public.reservations.reserved_by_name, '') = '';

insert into public.facilities (name)
values
  ('PBL 1'),
  ('PBL 2'),
  ('PBL 3'),
  ('PBL 4'),
  ('PBL 5'),
  ('PBL 6'),
  ('PBL 7'),
  ('PBL 8'),
  ('PBL 9'),
  ('강의실 A'),
  ('강의실 B')
on conflict (name) do nothing;

create or replace function public.is_med_kku_user()
returns boolean
language sql
stable
as $$
  select right(lower(coalesce(auth.jwt() ->> 'email', '')), length('@med.kku.ac.kr')) = '@med.kku.ac.kr';
$$;

create or replace function public.is_admin_user()
returns boolean
language sql
stable
as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) = 'dev@med.kku.ac.kr';
$$;

create or replace function public.can_cancel_reservation(target_date date, target_start_time integer)
returns boolean
language sql
stable
as $$
  with now_seoul as (
    select now() at time zone 'Asia/Seoul' as ts
  )
  select
    target_date > (select ts::date from now_seoul)
    or (
      target_date = (select ts::date from now_seoul)
      and make_time(target_start_time, 0, 0) > (select ts::time from now_seoul)
    );
$$;

create or replace function public.can_reserve_reservation(target_date date, target_start_time integer)
returns boolean
language sql
stable
as $$
  select public.can_cancel_reservation(target_date, target_start_time);
$$;

alter table public.profiles enable row level security;
alter table public.facilities enable row level security;
alter table public.reservations enable row level security;

drop policy if exists "Profiles are readable by owner" on public.profiles;
create policy "Profiles are readable by owner"
on public.profiles for select
to authenticated
using (auth.uid() = id and public.is_med_kku_user());

drop policy if exists "Profiles can be inserted by owner" on public.profiles;
create policy "Profiles can be inserted by owner"
on public.profiles for insert
to authenticated
with check (auth.uid() = id and public.is_med_kku_user());

drop policy if exists "Profiles can be updated by owner" on public.profiles;
create policy "Profiles can be updated by owner"
on public.profiles for update
to authenticated
using (auth.uid() = id and public.is_med_kku_user())
with check (auth.uid() = id and public.is_med_kku_user());

drop policy if exists "Facilities are readable by school users" on public.facilities;
create policy "Facilities are readable by school users"
on public.facilities for select
to authenticated
using (public.is_med_kku_user());

drop policy if exists "Facilities can be inserted by admin" on public.facilities;
create policy "Facilities can be inserted by admin"
on public.facilities for insert
to authenticated
with check (public.is_admin_user());

drop policy if exists "Facilities can be deleted by admin" on public.facilities;
create policy "Facilities can be deleted by admin"
on public.facilities for delete
to authenticated
using (public.is_admin_user());

drop policy if exists "Reservations are readable by school users" on public.reservations;
create policy "Reservations are readable by school users"
on public.reservations for select
to authenticated
using (public.is_med_kku_user());

drop policy if exists "Reservations can be inserted by owner" on public.reservations;
create policy "Reservations can be inserted by owner"
on public.reservations for insert
to authenticated
with check (
  auth.uid() = user_id
  and public.is_med_kku_user()
  and public.can_reserve_reservation(reservation_date, start_time)
);

drop policy if exists "Reservations can be deleted by owner" on public.reservations;
create policy "Reservations can be deleted by owner"
on public.reservations for delete
to authenticated
using (
  auth.uid() = user_id
  and public.is_med_kku_user()
  and public.can_cancel_reservation(reservation_date, start_time)
);

do $$
begin
  alter publication supabase_realtime add table public.reservations;
  alter publication supabase_realtime add table public.facilities;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

create or replace function public.enforce_med_kku_email_domain(event jsonb)
returns jsonb
language plpgsql
as $$
declare
  email text;
begin
  email := event->'user'->>'email';

  if email is null or right(lower(email), length('@med.kku.ac.kr')) <> '@med.kku.ac.kr' then
    return jsonb_build_object(
      'error',
      jsonb_build_object(
        'http_code', 403,
        'message', 'Only @med.kku.ac.kr accounts can sign up.'
      )
    );
  end if;

  return '{}'::jsonb;
end;
$$;

grant usage on schema public to supabase_auth_admin;
grant execute on function public.enforce_med_kku_email_domain to supabase_auth_admin;
revoke execute on function public.enforce_med_kku_email_domain from authenticated, anon, public;

-- Supabase Dashboard > Authentication > Hooks:
-- Enable "Before User Created" with this Postgres function URI:
-- pg-functions://postgres/public/enforce_med_kku_email_domain
