# Orchard Collection Professional v3.1.1 — Mobile Bottom Navigation Fix

This hotfix corrects the iPhone bottom navigation being shifted partially off-screen.

## Fixed
- Removes the inherited desktop centering transform.
- Forces the phone navigation into a stable five-column grid.
- Keeps all five controls inside the viewport.
- Preserves iPhone safe-area padding.
- Adds a service-worker cache marker.

## Install
Replace the deployed project with this package and redeploy through Cloudflare Pages. Fully close and reopen the Home Screen app afterward.
