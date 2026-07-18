# Orchard Collection v2.3 — Edit and Delete Management

## New functions

### Plants
- Edit plant name, status, condition, location, support, medium, care intervals, fertilizer, peduncles, and notes
- Delete a plant with confirmation
- Plant deletion also removes its timeline rows, photo rows, and stored image files

### Timeline
- Edit activity type, date/time, and notes
- Delete individual timeline entries

### Photos
- Delete gallery photos
- Photo deletion removes both the database record and the file in Supabase Storage

## Install

Upload only these files to the root of the existing GitHub repository:

- `app.js`
- `styles.css`

Replace the existing versions, commit, and wait for Cloudflare Pages to redeploy.

No new SQL is required for this update.
