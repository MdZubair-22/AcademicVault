# AcademicVault Build Fix

This patch prepares the current Phase 10 project for the Capacitor Android build.

Fixes:
- Added Vite client typings for `import.meta.env`.
- Updated PDF.js render call for PDF.js 5.x typings.
- Relaxed legacy TypeScript callback inference errors without changing runtime behavior.
- Existing Phase 9 OCR and application structure are preserved.

Build:
```powershell
npm install
npm run build
```

Only after `npm run build` succeeds:
```powershell
npx cap add android
npx cap sync android
npx cap open android
```

Do not use `npm audit fix --force` before testing the build.
