# AcademicVault Android setup (fixed)

This patch keeps the existing application code and adds a safe Android setup step so `cap sync android` does not fail just because the Android platform folder is missing.

## Important: run commands from the project root

The project root is the folder containing:

- `package.json`
- `capacitor.config.json`
- `src`

Do **not** run `npx cap sync android` from inside the `android` folder.

## First-time Android setup

```powershell
npm install
npm run build
npm run cap:setup
npx cap sync android
npx cap open android
```

`npm run cap:setup` automatically runs `npx cap add android` only when the `android` folder does not exist.

## Later code changes

After changing React/TypeScript/CSS code:

```powershell
npm run build
npx cap sync android
npx cap open android
```

Or use the combined command:

```powershell
npm run cap:sync
```

## If PowerShell is currently inside `android`

Go back one folder first:

```powershell
cd ..
```

Then run the commands above.

## Google OAuth values

The Android package ID configured by this project is:

```text
com.academicvault.app
```

Keep the Android OAuth client configured in Google Cloud for that package ID and its SHA-1 certificate. Do not put a Google client secret into the frontend source code.
