# AcademicVault — Modern Mobile UI Redesign

This patch changes the visual direction of AcademicVault toward a polished student mobile application, based on the supplied reference screenshots.

## Visual direction
- Clean white/light-blue student-app interface
- Blue primary accent with teal secondary accent
- Soft shadows and rounded cards
- Calm, readable typography
- Attractive gradients without excessive neon/glow
- Mobile bottom navigation: Home / Vault / Profile
- Existing side drawer remains available from the hamburger button
- Dark mode uses a calmer navy/blue palette with readable contrast

## Mobile navigation
- Bottom navigation is fixed above the Android gesture area.
- Home opens Dashboard.
- Vault opens Academic Records and remains highlighted for the document/certificate/achievement areas.
- Profile opens Profile.
- Existing hamburger drawer remains independently scrollable.
- Existing left-edge swipe-back behavior is preserved.

## Search
The existing partial/case-insensitive search patch is preserved.

## Data and backend
This UI patch does not intentionally change Supabase schema, authentication, OCR, document data, or sharing data structures.

## Build
Run on a machine with network/npm dependencies available:

```powershell
npm install
npm run build
```

The source was checked for TypeScript syntax after the UI changes. A full Vite build could not be completed in this environment because the package dependencies could not be installed from the npm registry.
