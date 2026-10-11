-- AcademicVault Phase 11: connected AI intelligence features
-- Phase 9 already provides public.document_ai_analysis.
-- This migration adds evidence mappings, summaries and duplicate-review records.

create table if not exists public.skill_evidence (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  skill_name text not null,
  source_type text not null default 'academic_record',
  source_id uuid,
  evidence_text text,
  confidence numeric(5,4),
  verified boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.academic_ai_summaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  period text not null,
  summary text not null,
  skills text[] not null default '{}',
  record_ids uuid[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.document_duplicates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  incoming_document_id uuid,
  matched_document_id uuid,
  similarity numeric(6,5) not null,
  reason text,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create index if not exists skill_evidence_user_idx on public.skill_evidence(user_id);
create index if not exists academic_ai_summaries_user_idx on public.academic_ai_summaries(user_id, created_at desc);
create index if not exists document_duplicates_user_idx on public.document_duplicates(user_id, created_at desc);

alter table public.skill_evidence enable row level security;
alter table public.academic_ai_summaries enable row level security;
alter table public.document_duplicates enable row level security;

drop policy if exists skill_evidence_own on public.skill_evidence;
create policy skill_evidence_own on public.skill_evidence for all using(auth.uid()=user_id) with check(auth.uid()=user_id);

drop policy if exists academic_ai_summaries_own on public.academic_ai_summaries;
create policy academic_ai_summaries_own on public.academic_ai_summaries for all using(auth.uid()=user_id) with check(auth.uid()=user_id);

drop policy if exists document_duplicates_own on public.document_duplicates;
create policy document_duplicates_own on public.document_duplicates for all using(auth.uid()=user_id) with check(auth.uid()=user_id);
