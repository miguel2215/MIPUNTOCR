import { readFile, writeFile, access } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
const manifestPath = resolve(root, 'android/app/src/main/AndroidManifest.xml');
const gradlePath = resolve(root, 'android/app/build.gradle');

await access(manifestPath);
await access(gradlePath);

let manifest = await readFile(manifestPath, 'utf8');
if (!manifest.includes('android.permission.CAMERA')) {
  manifest = manifest.replace(
    /<manifest([^>]*)>/,
    '<manifest$1>\n    <uses-permission android:name="android.permission.CAMERA" />\n    <uses-feature android:name="android.hardware.camera.any" android:required="false" />'
  );
}

// OAuth nativo: permite que Supabase regrese desde Chrome a PUNTO YA CR.
if (!manifest.includes('android:scheme="com.puntoyacr.app"')) {
  const deepLinkFilter = `\n            <intent-filter>\n                <action android:name="android.intent.action.VIEW" />\n                <category android:name="android.intent.category.DEFAULT" />\n                <category android:name="android.intent.category.BROWSABLE" />\n                <data android:scheme="com.puntoyacr.app" android:host="auth" android:pathPrefix="/callback" />\n            </intent-filter>`;
  manifest = manifest.replace(/(<activity[\s\S]*?<\/activity>)/, block => block.replace('</activity>', `${deepLinkFilter}\n        </activity>`));
}
await writeFile(manifestPath, manifest, 'utf8');

let gradle = await readFile(gradlePath, 'utf8');
gradle = gradle.replace(/versionCode\s+\d+/, 'versionCode 736');
gradle = gradle.replace(/versionName\s+["'][^"']+["']/, 'versionName "7.36.0"');
await writeFile(gradlePath, gradle, 'utf8');

console.log('Android preparado: cámara + OAuth deep link + versionCode 736 + versionName 7.36.0');
