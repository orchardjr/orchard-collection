# Orchard Collection v2 — Daily Collection System

## Important: run the SQL upgrade first

1. Open Supabase.
2. Open **SQL Editor**.
3. Create a new query.
4. Paste the entire contents of `supabase_upgrade.sql`.
5. Click **Run**.
6. Confirm that it reports success.

The SQL adds the standardized activity and photo fields, RLS policies, indexes, and the `plant-photos` Storage bucket.

## Deploy the website

After the SQL succeeds:

1. Upload `index.html`, `styles.css`, `app.js`, and `config.js` to the root of your GitHub repository.
2. Replace the older versions.
3. Commit the changes.
4. Wait for Cloudflare Pages to redeploy.

Do not upload `supabase_upgrade.sql` unless you want to keep it in the repository for documentation. It is not required by the website after being run.

## New features

- Live attention estimates for watering and fertilizing
- Dashboard activity metrics
- Card and location views
- Premium plant profiles
- One-tap care logging
- Optional notes on every event
- Plant-specific timelines
- Camera and photo-library uploads
- Supabase Storage gallery
- Full-screen photo viewer
- NFC-ready direct links
- Mobile-first controls

## Test sequence

1. Open a plant.
2. Tap **Watered** and save.
3. Confirm the timeline updates.
4. Tap **Add photo** and choose an image.
5. Confirm the photo appears in the gallery and on the card.
6. Open the same page on your iPhone.
