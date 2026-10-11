import fs from 'node:fs';
import path from 'node:path';

const target = path.resolve('android/app/src/main/res/xml/file_paths.xml');
const pluginsTarget = path.resolve('android/app/src/main/assets/capacitor.plugins.json');
if (!fs.existsSync(path.dirname(target))) {
  console.log('[AcademicVault] Android project not present yet; file-opener paths will be created after `npx cap add android`.');
  process.exit(0);
}

fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, `<?xml version="1.0" encoding="utf-8"?>\n<paths xmlns:android="http://schemas.android.com/apk/res/android">\n    <files-path name="files" path="." />\n    <cache-path name="cache" path="." />\n    <external-files-path name="external-files" path="." />\n    <external-cache-path name="external-cache" path="." />\n</paths>\n`);

if (fs.existsSync(pluginsTarget)) {
  const plugins = JSON.parse(fs.readFileSync(pluginsTarget, 'utf8'));
  const fileOpener = {
    pkg: '@capawesome-team/capacitor-file-opener',
    classpath: 'io.capawesome.capacitorjs.plugins.fileopener.FileOpenerPlugin',
  };
  if (!plugins.some((plugin) => plugin.pkg === fileOpener.pkg)) {
    plugins.push(fileOpener);
    fs.writeFileSync(pluginsTarget, `${JSON.stringify(plugins, null, '\t')}\n`);
    console.log('[AcademicVault] File-opener plugin registration added.');
  }
}
console.log('[AcademicVault] Android file-opener paths prepared.');
