-- AcademicVault Phase 9: AI/OCR analysis history
create table if not exists public.document_ai_analysis (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  document_id uuid references public.documents(id) on delete cascade,
  file_name text not null,
  category text,
  confidence numeric(5,4),
  extracted_text text,
  extracted_metadata jsonb not null default '{}'::jsonb,
  skills text[] not null default '{}',
  warnings text[] not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists document_ai_analysis_user_idx on public.document_ai_analysis(user_id, created_at desc);
create index if not exists document_ai_analysis_document_idx on public.document_ai_analysis(document_id);
alter table public.document_ai_analysis enable row level security;
drop policy if exists ai_analysis_own on public.document_ai_analysis;
create policy ai_analysis_own on public.document_ai_analysis for all using(auth.uid()=user_id) with check(auth.uid()=user_id);
