create extension if not exists "pgcrypto";
create table if not exists public.student_profiles(
 id uuid primary key references auth.users(id) on delete cascade,
 full_name text, usn text, college text, university text, degree text, branch text,
 batch text, current_semester text, bio text, linkedin_url text, github_url text,
 portfolio_url text, profile_photo_path text, created_at timestamptz default now(), updated_at timestamptz default now());
create table if not exists public.documents(
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 title text not null, category text not null, academic_year text, semester text, issuer text,
 issue_date date, description text, file_path text, file_name text, mime_type text, file_size bigint,
 tags text[] default '{}', created_at timestamptz default now(), updated_at timestamptz default now());
create table if not exists public.feedback(
 id uuid primary key default gen_random_uuid(),
 user_id uuid references auth.users(id) on delete cascade,
 rating integer not null check (rating between 1 and 5),
 category text not null default 'Other',
 message text not null,
 created_at timestamptz default now());
create index if not exists documents_user_id_idx on public.documents(user_id);
create index if not exists documents_category_idx on public.documents(category);
create index if not exists feedback_user_id_idx on public.feedback(user_id);
alter table public.student_profiles enable row level security;
alter table public.documents enable row level security;
alter table public.feedback enable row level security;
create policy "profiles own rows" on public.student_profiles for all using(auth.uid()=id) with check(auth.uid()=id);
create policy "documents own rows" on public.documents for all using(auth.uid()=user_id) with check(auth.uid()=user_id);
create policy "feedback own rows" on public.feedback for all using(auth.uid()=user_id) with check(auth.uid()=user_id);
-- Create a PRIVATE Supabase Storage bucket named academicvault-documents.
-- Add storage policies restricting paths to the authenticated user's ID.
