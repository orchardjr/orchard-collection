# Orchard Collection Phase 1 — Brand Foundation

## Included
- Approved leafy app icon in all required sizes
- Apple Home Screen icon
- Android/PWA icons
- Maskable icon
- Favicons and favicon.ico
- SVG logo mark
- Horizontal dark and light logo lockups
- Branded splash screen in SVG and PNG
- Production web manifest
- Service worker for cached brand assets
- Brand color and typography tokens
- Patched website files

## Install
Upload every file in this folder to the root of your GitHub repository, replacing files with the same names.

Important files to replace:
- index.html
- app.js
- styles.css

New files to add:
- apple-touch-icon.png
- icon-192.png
- icon-512.png
- icon-1024.png
- maskable-icon-512.png
- favicon.ico
- favicon-16.png
- favicon-32.png
- favicon-48.png
- logo-mark.svg
- logo-horizontal.svg
- logo-horizontal-light.svg
- splash-screen.svg
- splash-screen.png
- brand.css
- manifest.webmanifest
- service-worker.js

After Cloudflare redeploys:
1. Delete the old Orchard Collection Home Screen shortcut.
2. Open the website in Safari.
3. Refresh the page once.
4. Use Share → Add to Home Screen.
5. The approved leafy icon should appear.

iOS caches icons aggressively, so deleting and re-adding the shortcut is required.
