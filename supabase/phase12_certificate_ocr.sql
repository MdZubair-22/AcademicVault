-- AcademicVault Phase 12: certificate OCR and review metadata.
-- Existing certificates RLS policies continue to scope these fields by user_id.

alter table public.certificates
  add column if not exists recipient_name text,
  add column if not exists ocr_text text,
  add column if not exists ocr_status text not null default 'not_processed',
  add column if not exists ocr_engine text,
  add column if not exists ocr_engine_confidence numeric(5,4),
  add column if not exists ocr_metadata jsonb not null default '{}'::jsonb;

alter table public.certificates
  drop constraint if exists certificates_ocr_status_check;

alter table public.certificates
  add constraint certificates_ocr_status_check
  check (ocr_status in ('not_processed', 'high', 'medium', 'low', 'failed'));

alter table public.certificates
  drop constraint if exists certificates_ocr_engine_confidence_check;

alter table public.certificates
  add constraint certificates_ocr_engine_confidence_check
  check (
    ocr_engine_confidence is null
    or ocr_engine_confidence between 0 and 1
  );
