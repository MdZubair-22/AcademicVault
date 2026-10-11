-- AcademicVault Phase 4: private academic document management
create extension if not exists pgcrypto;

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  academic_year_id uuid references public.academic_years(id) on delete set null,
  semester_id uuid references public.semesters(id) on delete set null,
  title text not null,
  document_type text not null check (document_type in ('marksheet','grade_card','transcript','academic_letter','degree','other')),
  institution text,
  document_date date,
  description text,
  tags text[] not null default '{}',
  notes text,
  file_path text not null,
  file_name text not null,
  file_type text not null,
  file_size bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists documents_user_id_idx on public.documents(user_id);
create index if not exists documents_semester_id_idx on public.documents(semester_id);
create index if not exists documents_year_id_idx on public.documents(academic_year_id);
create index if not exists documents_type_idx on public.documents(document_type);
create index if not exists documents_date_idx on public.documents(document_date desc);
create index if not exists documents_title_idx on public.documents using gin (to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(institution,'') || ' ' || coalesce(description,'')));

alter table public.documents enable row level security;
drop policy if exists documents_select_own on public.documents;
drop policy if exists documents_insert_own on public.documents;
drop policy if exists documents_update_own on public.documents;
drop policy if exists documents_delete_own on public.documents;
create policy documents_select_own on public.documents for select using (auth.uid() = user_id);
create policy documents_insert_own on public.documents for insert with check (auth.uid() = user_id);
create policy documents_update_own on public.documents for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy documents_delete_own on public.documents for delete using (auth.uid() = user_id);

create or replace function public.set_documents_updated_at() returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end; $$;
drop trigger if exists documents_updated_at on public.documents;
create trigger documents_updated_at before update on public.documents for each row execute procedure public.set_documents_updated_at();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('academic-documents', 'academic-documents', false, 15728640, array['application/pdf','image/jpeg','image/png'])
on conflict (id) do update set public=false, file_size_limit=15728640, allowed_mime_types=array['application/pdf','image/jpeg','image/png'];

drop policy if exists academic_documents_select_own on storage.objects;
drop policy if exists academic_documents_insert_own on storage.objects;
drop policy if exists academic_documents_update_own on storage.objects;
drop policy if exists academic_documents_delete_own on storage.objects;
create policy academic_documents_select_own on storage.objects for select to authenticated using (bucket_id='academic-documents' and (storage.foldername(name))[1] = auth.uid()::text);
create policy academic_documents_insert_own on storage.objects for insert to authenticated with check (bucket_id='academic-documents' and (storage.foldername(name))[1] = auth.uid()::text);
create policy academic_documents_update_own on storage.objects for update to authenticated using (bucket_id='academic-documents' and (storage.foldername(name))[1] = auth.uid()::text) with check (bucket_id='academic-documents' and (storage.foldername(name))[1] = auth.uid()::text);
create policy academic_documents_delete_own on storage.objects for delete to authenticated using (bucket_id='academic-documents' and (storage.foldername(name))[1] = auth.uid()::text);
