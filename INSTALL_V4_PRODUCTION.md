# Deploy Orchard Collection Professional v4.0

1. Upload this folder or ZIP to the existing `orchard-collection` Cloudflare Pages project, or push it to the connected GitHub repository.
2. Keep both custom domains attached:
   - `orchardcollection.ca`
   - `app.orchardcollection.ca`
3. Confirm both domains show **Active** under Pages → Custom domains.
4. Open each hostname in a private Safari window:
   - Root domain should show the public landing website.
   - App subdomain should show the Orchard Collection sign-in screen.
5. On iPhone, remove the old Home Screen installation and add the app again from `https://app.orchardcollection.ca` so the production manifest is used.
6. Existing database content is untouched; no SQL migration is required for this release.

## Cache note
The service-worker cache was renamed to `orchard-production-v4-0-0`. A hard refresh may be necessary immediately after deployment.
