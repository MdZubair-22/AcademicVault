GOOGLE DRIVE FEATURE PATCH — 2 FILES ONLY

Base project already contains the Google Sign-In dependency and the /google-drive route.
Copy/replace only:
  src/lib/googleDrive.ts
  src/pages/GoogleDrive.tsx

No npm install is required if the uploaded base project is the one being used; it already has:
  @capawesome/capacitor-google-sign-in

After copying:
  npm run build
  npx cap sync android

Google Cloud values:
- Web client ID is read from VITE_GOOGLE_WEB_CLIENT_ID, with the configured Web client ID as fallback.
- Android package must remain com.academicvault.app.
- Android OAuth client is configured in Google Cloud separately; the plugin receives the Web client ID.
- Scope used: https://www.googleapis.com/auth/drive.file

This patch does not change Supabase schema, local storage, upload UI, navigation, or other features.
