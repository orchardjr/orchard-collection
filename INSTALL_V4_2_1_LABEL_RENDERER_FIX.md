# Orchard Collection v4.2.1 — Label Renderer Fix

This release fixes the mismatch between the on-screen label preview and the
generated PNG/print output.

## Fixed

- Preview, PNG export, single-label printing, and batch printing now use the
  same high-resolution 300-DPI canvas renderer.
- The preview is now an exact image of the file that will be saved or printed.
- Long plant names automatically reduce in size or wrap so they are not cut off.
- QR codes, margins, font sizes, line breaks, and element positions remain
  identical across preview and output.
- QR rendering is sharpened for Brother thermal label output.
- Existing Label Center, plants, photos, and all previous fixes are preserved.

## Deploy

Upload the complete ZIP contents to the existing Cloudflare Pages project.
After deployment, fully close the installed app and reopen it. If the older
preview remains, open app.orchardcollection.ca in Safari and refresh once.
