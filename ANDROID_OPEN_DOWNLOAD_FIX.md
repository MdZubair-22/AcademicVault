# Android Open / Download targeted fix

This patch changes only document Open/Download handling. Existing upload/storage data is preserved.

## After extracting

```powershell
npm install
npm run build
```

If the project does not already have an `android` folder:

```powershell
npm run cap:add
```

If the `android` folder already exists:

```powershell
npm run cap:sync
```

Then open Android Studio:

```powershell
npx cap open android
```

The fix uses native Capacitor file handling on Android so the existing local IndexedDB/Supabase-backed document data does not need to be migrated.

- **Open:** saves the selected document temporarily and opens it with the Android app associated with its MIME type.
- **Download:** saves the document to the app's Documents directory and opens the Android native save/share sheet so the user can choose Files/Downloads or another app.
- **Web:** keeps the existing browser behavior.

Use `npm run cap:sync` rather than a bare `npx cap sync android` so the Android FileProvider path configuration is also prepared.
