# Orchard Collection v4.0.6 — Existing Photo Upload

## Change

The Add Photo button previously forced the phone's rear camera because the file
input used `capture="environment"`.

That attribute has been removed. The photo picker now supports:

- Choosing an existing image from the iPhone or iPad Photo Library
- Selecting an image from Files
- Taking a new photo when desired
- Choosing an image file from a Mac or PC

## Deploy

Upload the complete contents of this ZIP to the existing Cloudflare Pages
project. After the deployment succeeds, close and reopen the installed app.

If the old camera-only picker remains, open `app.orchardcollection.ca` once in
Safari and refresh the page so the v4.0.6 service worker is installed.
