# Orchard Collection v4.2.3 — Forced Label Update

The uploaded v4.2.2 package was inspected directly. Its label editor and button
handlers are present, so the installed PWA was continuing to load an older
cached JavaScript bundle.

## What this release changes

- Renames the application bundle to `app-v423.js`
- Renames the stylesheet to `styles-v423.css`
- Automatically unregisters all old Orchard Collection service workers
- Deletes all existing app caches
- Reloads once with a unique build query
- Adds a small visible `v4.2.3` marker so the loaded version can be confirmed
- Preserves the editable label fields, Save PNG, Print Label, and exact renderer
- Temporarily disables offline caching until the label workflow is confirmed

## Deployment check

After deploying the full ZIP, open `app.orchardcollection.ca` directly in
Safari. The bottom-right corner must show `v4.2.3`. Only then reopen the Home
Screen app. If the marker does not appear, Cloudflare is not serving this
deployment.
