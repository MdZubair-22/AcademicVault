# AcademicVault Local-First Testing

## Storage architecture

- **Supabase Auth only:** email/password signup, login, session and password reset.
- **Local device:** profile, academic journey, records, certificates, achievements, projects, internships, courses, skills, share snapshots, OCR results/metadata and uploaded files.
- Binary files are stored in IndexedDB. Metadata is stored locally.
- No academic data is sent to Supabase while `VITE_DATA_MODE=local`.

## Environment

```env
VITE_DATA_MODE=local
VITE_SUPABASE_URL=YOUR_REAL_SUPABASE_URL
VITE_SUPABASE_ANON_KEY=YOUR_REAL_SUPABASE_PUBLISHABLE_KEY
```

The Supabase URL/key are required because authentication is intentionally kept in Supabase even in local mode.

## Optional future cloud backup

When cloud backup is intentionally enabled, switch the data mode to `supabase` and use the existing Supabase schema/storage implementation. The local data layer remains available and can later be extended with explicit Backup / Restore / Sync controls.

## Important

Do not put a Supabase service-role key in Vite environment variables. Only use the browser-safe publishable/anon key.
