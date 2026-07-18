# Orchard Collection v4.0.1 — Logo Icon Update

This release replaces every PWA, iPhone Home Screen, favicon, and maskable icon
with the exact Orchard Collection **O mark** used in the horizontal logo.

## Deploy

1. Upload the complete contents of this ZIP to the existing
   `orchard-collection` Cloudflare Pages project.
2. Wait for the production deployment to finish.
3. On iPhone, delete the old Orchard Collection icon from the Home Screen.
4. Open `https://app.orchardcollection.ca` in Safari.
5. Tap **Share → Add to Home Screen**.

The service-worker cache was advanced to `v4.0.1`, so the updated assets will
replace the former icon after deployment.

## Updated assets

- `apple-touch-icon.png`
- `icon-192.png`
- `icon-512.png`
- `maskable-icon-512.png`
- `icon-1024.png`
- `favicon-16.png`
- `favicon-32.png`
- `favicon-48.png`
- `favicon.ico`
- `logo-mark.svg`
- `service-worker.js`
