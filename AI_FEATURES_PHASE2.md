# AcademicVault Phase 2 AI Features

Integrated into this project:

- AI Document Classification: already present in `src/lib/documentAI.ts` and used by Academic Records upload.
- AI Smart Search: new `/ai-insights` workspace with natural-language keyword interpretation.
- AI Skill Extraction: existing OCR skill extraction is reused and exposed through skill-evidence mapping.
- Skill–Evidence Mapping: aggregates skills/tags from certificates, projects, internships, courses and academic records.
- AI Academic Summary: creates semester/year/collection summaries from saved academic evidence.
- Duplicate Document Detection: compares a proposed document title/content signals against existing records.
- Google Drive: existing backup/sync remains available and the duplicate feature can be used before sync decisions.

## Setup

1. Run `supabase/phase11_ai_features.sql` in your Supabase SQL editor.
2. Run `npm run typecheck`.
3. Run `npm run build`.
4. Open `/ai-insights` after login.

The current project already uses client-side Tesseract OCR and rule-based academic extraction. These six features are integrated on top of that existing pipeline. If you later connect a server-side LLM, replace/extend the AI provider while keeping secrets off the client.
