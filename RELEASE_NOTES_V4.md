# Orchard Collection Professional v4.0 — Production Foundation

## Production domains
- `orchardcollection.ca` now renders the public product website.
- `app.orchardcollection.ca` renders the authenticated collection application.
- Plant QR, NFC and copy-link actions now always use stable production URLs on `app.orchardcollection.ca`.

## Public website
- Responsive collector-focused landing page.
- Product preview, core feature overview and app launch links.
- Production Open Graph, canonical and application metadata.

## Application
- Existing Supabase authentication, plants, photographs and activity history are preserved.
- Denser mobile layout and refined card treatment.
- Updated PWA manifest, app shortcuts and production service-worker cache.

## Important
Both hostnames may remain attached to the same Cloudflare Pages project. The application selects the correct experience from the incoming hostname.
