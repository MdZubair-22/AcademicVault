# AcademicVault — Android Mobile UX Patch

This patch updates the existing Phase 10 AuthOnly LocalData project with:

- Independently scrollable mobile side drawer.
- Body scroll lock while the drawer is open.
- Sticky drawer header and safe-area spacing.
- Android-style `← Dashboard` back control styling.
- Left-edge swipe-back navigation to `/dashboard` on authenticated app pages.
- Swipe protection for inputs, buttons, modals, and the navigation drawer.
- Case-insensitive partial/substring search across the main feature lists.
- Shared search normalization helper in `src/lib/search.ts`.
- Improved mobile modal scrolling behavior.

## Build

Run locally from the project directory:

```powershell
npm install
npm run build
```

The source package was prepared in the build environment, but dependency installation was unavailable there because the npm registry/cache was not accessible. Therefore the final Vite build could not be independently executed in this environment.
