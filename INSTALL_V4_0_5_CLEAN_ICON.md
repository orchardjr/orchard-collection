# Orchard Collection v4.0.5 — Clean App Icon

The previous icon was extracted from a Home Screen mockup. Because that mockup
already had rounded corners, small portions of the dog photograph remained in
the four corners of the exported PNG.

This release removes the mockup background completely and supplies a full-bleed
deep-green square icon. iOS now applies its own rounded-corner mask, with no
photograph behind it.

## Deploy

1. Upload the complete ZIP contents to the existing Cloudflare Pages project.
2. Wait for the production deployment to finish.
3. Remove the existing Orchard Collection app from the iPhone Home Screen.
4. Open **Settings → Safari → Clear History and Website Data**.
5. Reopen Safari and visit `https://app.orchardcollection.ca`.
6. Use **Share → Add to Home Screen**.
