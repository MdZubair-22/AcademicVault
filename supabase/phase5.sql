-- AcademicVault Phase 5: Certificates, Achievements, Projects
create extension if not exists pgcrypto;

create table if not exists public.certificates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  academic_year_id uuid references public.academic_years(id) on delete set null,
  semester_id uuid references public.semesters(id) on delete set null,
  certificate_title text not null,
  course_name text,
  category text not null default 'technical',
  issuing_organization text,
  issue_date date,
  certificate_id text,
  skills text[] not null default '{}',
  description text,
  tags text[] not null default '{}',
  file_path text,
  file_name text,
  file_type text,
  file_size bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  academic_year_id uuid references public.academic_years(id) on delete set null,
  semester_id uuid references public.semesters(id) on delete set null,
  title text not null,
  category text not null default 'other',
  organization text,
  achievement_date date,
  rank_position text,
  location text,
  description text,
  url text,
  tags text[] not null default '{}',
  file_path text,
  file_name text,
  file_type text,
  file_size bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  academic_year_id uuid references public.academic_years(id) on delete set null,
  semester_id uuid references public.semesters(id) on delete set null,
  title text not null,
  description text,
  problem_statement text,
  technologies text[] not null default '{}',
  role text,
  start_date date,
  end_date date,
  github_url text,
  live_demo_url text,
  report_path text,
  report_name text,
  report_type text,
  report_size bigint,
  screenshots text[] not null default '{}',
  team_members text[] not null default '{}',
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists certificates_user_created_idx on public.certificates(user_id, created_at desc);
create index if not exists certificates_year_idx on public.certificates(academic_year_id);
create index if not exists certificates_semester_idx on public.certificates(semester_id);
create index if not exists achievements_user_created_idx on public.achievements(user_id, created_at desc);
create index if not exists achievements_year_idx on public.achievements(academic_year_id);
create index if not exists achievements_semester_idx on public.achievements(semester_id);
create index if not exists projects_user_created_idx on public.projects(user_id, created_at desc);
create index if not exists projects_year_idx on public.projects(academic_year_id);
create index if not exists projects_semester_idx on public.projects(semester_id);

create or replace function public.touch_phase5_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists certificates_updated_at on public.certificates;
create trigger certificates_updated_at before update on public.certificates for each row execute function public.touch_phase5_updated_at();
drop trigger if exists achievements_updated_at on public.achievements;
create trigger achievements_updated_at before update on public.achievements for each row execute function public.touch_phase5_updated_at();
drop trigger if exists projects_updated_at on public.projects;
create trigger projects_updated_at before update on public.projects for each row execute function public.touch_phase5_updated_at();

alter table public.certificates enable row level security;
alter table public.achievements enable row level security;
alter table public.projects enable row level security;

drop policy if exists certificates_select_own on public.certificates;
drop policy if exists certificates_insert_own on public.certificates;
drop policy if exists certificates_update_own on public.certificates;
drop policy if exists certificates_delete_own on public.certificates;
create policy certificates_select_own on public.certificates for select using (auth.uid() = user_id);
create policy certificates_insert_own on public.certificates for insert with check (auth.uid() = user_id);
create policy certificates_update_own on public.certificates for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy certificates_delete_own on public.certificates for delete using (auth.uid() = user_id);

drop policy if exists achievements_select_own on public.achievements;
drop policy if exists achievements_insert_own on public.achievements;
drop policy if exists achievements_update_own on public.achievements;
drop policy if exists achievements_delete_own on public.achievements;
create policy achievements_select_own on public.achievements for select using (auth.uid() = user_id);
create policy achievements_insert_own on public.achievements for insert with check (auth.uid() = user_id);
create policy achievements_update_own on public.achievements for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy achievements_delete_own on public.achievements for delete using (auth.uid() = user_id);

drop policy if exists projects_select_own on public.projects;
drop policy if exists projects_insert_own on public.projects;
drop policy if exists projects_update_own on public.projects;
drop policy if exists projects_delete_own on public.projects;
create policy projects_select_own on public.projects for select using (auth.uid() = user_id);
create policy projects_insert_own on public.projects for insert with check (auth.uid() = user_id);
create policy projects_update_own on public.projects for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy projects_delete_own on public.projects for delete using (auth.uid() = user_id);

insert into storage.buckets (id, name, public) values ('portfolio-files','portfolio-files',false) on conflict (id) do nothing;

drop policy if exists portfolio_files_select_own on storage.objects;
drop policy if exists portfolio_files_insert_own on storage.objects;
drop policy if exists portfolio_files_update_own on storage.objects;
drop policy if exists portfolio_files_delete_own on storage.objects;
create policy portfolio_files_select_own on storage.objects for select using (bucket_id='portfolio-files' and auth.uid()::text = (storage.foldername(name))[1]);
create policy portfolio_files_insert_own on storage.objects for insert with check (bucket_id='portfolio-files' and auth.uid()::text = (storage.foldername(name))[1]);
create policy portfolio_files_update_own on storage.objects for update using (bucket_id='portfolio-files' and auth.uid()::text = (storage.foldername(name))[1]) with check (bucket_id='portfolio-files' and auth.uid()::text = (storage.foldername(name))[1]);
create policy portfolio_files_delete_own on storage.objects for delete using (bucket_id='portfolio-files' and auth.uid()::text = (storage.foldername(name))[1]);
