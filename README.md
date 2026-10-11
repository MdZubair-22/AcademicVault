# AcademicVault — Phase 7

Phase 7 adds real global search and analytics on top of Phases 1–6.

## Supabase
Run `supabase/phase7.sql` in the Supabase SQL Editor. It adds only search/date indexes; it does not create duplicate tables.

## Google Drive OAuth
Create a **Web application** OAuth client in Google Cloud Console and set `VITE_GOOGLE_WEB_CLIENT_ID` in `.env` to its client ID. Add the exact redirect URL used by the app under **Authorized redirect URIs** (for local development, `http://localhost:5173/google-drive`) and add its origin (`http://localhost:5173`) under **Authorized JavaScript origins**. Use the matching host consistently; `localhost` and `127.0.0.1` are different OAuth origins. For deployment, register the production origin and its `/google-drive` redirect URI as well. Restart Vite after changing `.env`.

## Local setup
Keep the `.env` from your working Phase 6 project. Then:

```bash
npm install
npm run dev
```

## New routes
- `/search` — grouped global search with category/year/semester/date/institution/skill/document-type filters.
- `/analytics` — database-backed counts and charts.

No demo records are created. All displayed results are queried from the authenticated user's existing Supabase data.

## OCR document review

Academic-record uploads are processed in the browser with PDF.js and Tesseract.js; document content is not sent to a new third-party OCR service. Text-based PDF pages use selectable text, while scanned or sparse pages use OCR. Mixed PDFs retain per-page boundaries. OCR suggestions remain editable and require the user to review and save them. Originals remain in the existing private `academic-documents` Supabase bucket; the existing `document_ai_analysis` table stores OCR text, the actual Tesseract confidence when available, extraction details, and review warnings under its existing RLS policies.

Certificate OCR uses the same local pipeline and review-before-save flow. To persist certificate holder names, OCR text/status, engine confidence, extraction details, grades, and confirmed field values, run `supabase/phase12_certificate_ocr.sql` in the Supabase SQL Editor. It adds columns to the existing `certificates` table and does not change its user-scoped RLS policies. Apply this migration before deploying the certificate UI changes.

Uploads are limited to 15 MB and PDF processing is capped at 20 pages. Large images are bounded before canvas processing. OCR quality bands and image blur/contrast warnings are explicitly heuristic and have not been calibrated against a representative document corpus. Tesseract confidence is shown separately and is not a guarantee of field accuracy. Ambiguous numeric dates are left blank for manual review.

Run the deterministic OCR helper tests with:

```bash
npm run test:ocr
```

The repository does not currently contain a verified image/PDF OCR benchmark corpus. CER/WER and field/classification metric helpers are available in `src/lib/ocrMetrics.ts`, but no real-document accuracy comparison is reported until a consented, manually verified corpus is added. To establish a comparable baseline, use the same original documents, expected text/fields/categories, and processing-time capture for both pipeline versions; keep test documents and any identifying academic records out of source control.
