import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
const webDir = resolve(root, 'www');
const files = [
  'index.html',
  'manifest.webmanifest',
  'service-worker.js',
  'logo-horizontal.png',
  'logo-vertical.png',
  'icon-192.png',
  'icon-512.png',
  'icon-maskable-192.png',
  'icon-maskable-512.png',
  'apple-touch-icon.png',
  'favicon-32.png',
  'splash-portrait.png',
  'splash-landscape.png'
];

await rm(webDir, { recursive: true, force: true });
await mkdir(webDir, { recursive: true });
for (const file of files) {
  await cp(resolve(root, file), resolve(webDir, file));
}

// Native builds already bundle all local assets. Avoid a second service-worker cache
// inside the native WebView while keeping the normal PWA unchanged on the web.
const indexPath = resolve(webDir, 'index.html');
let html = await readFile(indexPath, 'utf8');
html = html.replace(
  'if ("serviceWorker" in navigator) navigator.serviceWorker.register("./service-worker.js").catch(console.error);',
  'if (!window.Capacitor?.isNativePlatform?.() && "serviceWorker" in navigator) navigator.serviceWorker.register("./service-worker.js").catch(console.error);'
);
await writeFile(indexPath, html, 'utf8');
console.log(`Contenido móvil preparado en ${webDir}`);
