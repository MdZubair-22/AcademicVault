-- AcademicVault Phase 3: Academic years, semesters, and journey timeline
-- Safe to run after Phase 2.

create extension if not exists pgcrypto;

create table if not exists public.academic_years (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  year_label text not null,
  start_year integer,
  end_year integer,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint academic_years_years_valid check (
    (start_year is null and end_year is null) or
    (start_year is not null and end_year is not null and end_year >= start_year)
  )
);

create index if not exists academic_years_user_sort_idx
  on public.academic_years(user_id, sort_order, start_year);

create table if not exists public.semesters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  academic_year_id uuid not null references public.academic_years(id) on delete cascade,
  name text not null,
  semester_number integer,
  status text not null default 'planned',
  notes text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint semesters_number_valid check (semester_number is null or semester_number between 1 and 12),
  constraint semesters_status_valid check (status in ('planned','in_progress','completed'))
);

create index if not exists semesters_user_year_sort_idx
  on public.semesters(user_id, academic_year_id, sort_order, semester_number);

create index if not exists semesters_user_status_idx
  on public.semesters(user_id, status);

alter table public.academic_years enable row level security;
alter table public.semesters enable row level security;

drop policy if exists "academic_years_select_own" on public.academic_years;
drop policy if exists "academic_years_insert_own" on public.academic_years;
drop policy if exists "academic_years_update_own" on public.academic_years;
drop policy if exists "academic_years_delete_own" on public.academic_years;

create policy "academic_years_select_own" on public.academic_years
for select to authenticated using (auth.uid() = user_id);

create policy "academic_years_insert_own" on public.academic_years
for insert to authenticated with check (auth.uid() = user_id);

create policy "academic_years_update_own" on public.academic_years
for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "academic_years_delete_own" on public.academic_years
for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "semesters_select_own" on public.semesters;
drop policy if exists "semesters_insert_own" on public.semesters;
drop policy if exists "semesters_update_own" on public.semesters;
drop policy if exists "semesters_delete_own" on public.semesters;

create policy "semesters_select_own" on public.semesters
for select to authenticated using (auth.uid() = user_id);

create policy "semesters_insert_own" on public.semesters
for insert to authenticated with check (
  auth.uid() = user_id and exists (
    select 1 from public.academic_years ay
    where ay.id = academic_year_id and ay.user_id = auth.uid()
  )
);

create policy "semesters_update_own" on public.semesters
for update to authenticated
using (auth.uid() = user_id)
with check (
  auth.uid() = user_id and exists (
    select 1 from public.academic_years ay
    where ay.id = academic_year_id and ay.user_id = auth.uid()
  )
);

create policy "semesters_delete_own" on public.semesters
for delete to authenticated using (auth.uid() = user_id);

create or replace function public.set_academic_vault_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists academic_years_updated_at on public.academic_years;
create trigger academic_years_updated_at
before update on public.academic_years
for each row execute procedure public.set_academic_vault_updated_at();

drop trigger if exists semesters_updated_at on public.semesters;
create trigger semesters_updated_at
before update on public.semesters
for each row execute procedure public.set_academic_vault_updated_at();
