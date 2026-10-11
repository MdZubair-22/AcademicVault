# AcademicVault Phase 9 — OCR + AI Document Processing

## What was added
- Browser-side OCR using Tesseract.js for JPG/PNG files.
- PDF page rendering using pdfjs-dist (first 3 pages) followed by OCR.
- Document type classification with confidence scoring.
- Metadata extraction for title, institution, date, certificate ID and semester.
- Skill keyword detection.
- User review card before saving.
- AI progress indicator and low-confidence warnings.
- Supabase migration for optional AI-analysis history.

## User flow
Upload PDF/JPG/PNG -> OCR -> classify -> extract metadata -> review suggestions -> edit if necessary -> save.

## Important
AI suggestions are not treated as authoritative. The user must review the fields before saving.

## Install
Run `npm install` after extracting the project. Then `npm run build` and `npm run dev`.

## Supabase
If cloud AI-analysis history is wanted, run `supabase/phase9.sql` in the Supabase SQL editor. The current UI uses the browser AI pipeline; the migration is prepared for saving analysis history later.
