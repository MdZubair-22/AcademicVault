-- AcademicVault Phase 1: profile foundation + RLS
create table if not exists public.student_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '', profile_photo_url text, student_id text, college text, university text,
  degree text, branch text, batch text, current_semester text, email text, linkedin text, github text, portfolio text,
  bio text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.student_profiles enable row level security;
drop policy if exists "profiles_select_own" on public.student_profiles;
drop policy if exists "profiles_insert_own" on public.student_profiles;
drop policy if exists "profiles_update_own" on public.student_profiles;
drop policy if exists "profiles_delete_own" on public.student_profiles;
create policy "profiles_select_own" on public.student_profiles for select using (auth.uid()=id);
create policy "profiles_insert_own" on public.student_profiles for insert with check (auth.uid()=id);
create policy "profiles_update_own" on public.student_profiles for update using (auth.uid()=id) with check (auth.uid()=id);
create policy "profiles_delete_own" on public.student_profiles for delete using (auth.uid()=id);
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
begin insert into public.student_profiles(id,full_name,email) values(new.id,coalesce(new.raw_user_meta_data->>'full_name',''),new.email) on conflict(id) do nothing; return new; end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();
create or replace function public.set_updated_at() returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end; $$;
drop trigger if exists student_profiles_updated_at on public.student_profiles;
create trigger student_profiles_updated_at before update on public.student_profiles for each row execute procedure public.set_updated_at();
