# Orchard Collection — Phase 1 Step 2

## New
- Native fixed bottom navigation
- Dashboard as the default home screen
- Cloud-synced favorites
- Favorites screen
- Global Quick Add menu
- Add Plant from inside the app
- Quick care logging without opening a plant first
- Quick photo upload flow
- Collection search, sorting, card view, and location view
- Settings screen
- Back/forward browser navigation
- Mobile-first transitions and layout

## Install order

### 1. Run SQL
Open Supabase → SQL Editor and run `supabase_step2_upgrade.sql`.

### 2. Upload files
Upload all files in this folder to the root of the GitHub repository, replacing existing files.

At minimum, replace:
- `app.js`
- `styles.css`

And keep the new SQL file for reference.

### 3. Redeploy
Commit to GitHub and wait for Cloudflare Pages.

### 4. Refresh the installed Home Screen app
Close it completely and reopen it. If iOS keeps an old version, remove the Home Screen icon and add it again from Safari.
