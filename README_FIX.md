# Orchard Collection v2.1 — plant_id compatibility fix

This fixes the error:

`null value in column "plant_id" of relation "activity_log" violates not-null constraint`

Your original activity table requires the plant's internal database ID. The app now sends:

- `plant_id`
- `plant_accession`
- `owner_id`

for every care event.

## Install

Upload only the new `app.js` to the root of your GitHub repository and replace the existing file.

Commit the change and wait for Cloudflare Pages to redeploy.

Then reopen a plant and test **Watered** again.

## Photo compatibility

The photo uploader now also supplies `plant_id`. If a future photo upload reports that the `photos` table does not contain a `plant_id` column, run `optional_compatibility_patch.sql` in Supabase.
