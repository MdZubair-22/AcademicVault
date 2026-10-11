# AcademicVault — Google Drive feature patch

Copy these files into the existing project:
- `package.json` — replace existing file
- `src/App.tsx` — replace existing file
- `src/lib/googleDrive.ts` — new file
- `src/pages/GoogleDrive.tsx` — new file

Then from the project root run:
`npm install`
`npm run build`
`npx cap sync android`

The feature uses the Google web OAuth client ID configured in the source as a public client ID, and requests only `drive.file`.
Open AcademicVault -> Menu -> Google Drive -> Connect Google Drive.

Local AcademicVault data remains the primary copy. The sync uploads existing local document files to the user's own Google Drive under:
AcademicVault/
  Academic Records/
  Certificates/
  Achievements/
  Projects/
  Internships/
  Courses/
  Skills/

Repeated syncs update the same Drive file when its local record/path mapping is known, and otherwise reuse a matching filename in the same folder. No Supabase data schema or file storage is changed by this patch.
