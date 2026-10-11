create extension if not exists pg_trgm;
-- Phase 7: search and analytics performance indexes. No new tables are required.
create index if not exists documents_title_trgm_idx on public.documents using gin (title gin_trgm_ops);
create index if not exists certificates_title_trgm_idx on public.certificates using gin (certificate_title gin_trgm_ops);
create index if not exists achievements_title_trgm_idx on public.achievements using gin (title gin_trgm_ops);
create index if not exists projects_title_trgm_idx on public.projects using gin (title gin_trgm_ops);
create index if not exists internships_company_trgm_idx on public.internships using gin (company gin_trgm_ops);
create index if not exists courses_name_trgm_idx on public.courses using gin (course_name gin_trgm_ops);
create index if not exists skills_name_trgm_idx on public.skills using gin (name gin_trgm_ops);
create index if not exists documents_user_date_idx on public.documents(user_id, document_date desc);
create index if not exists certificates_user_date_idx on public.certificates(user_id, issue_date desc);
create index if not exists achievements_user_date_idx on public.achievements(user_id, achievement_date desc);
create index if not exists projects_user_date_idx on public.projects(user_id, start_date desc);
create index if not exists internships_user_date_idx on public.internships(user_id, start_date desc);
create index if not exists courses_user_date_idx on public.courses(user_id, completion_date desc);
