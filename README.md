# Orchard Collection — Live Supabase Edition

This is a static, Cloudflare Pages-compatible plant collection app.

## Included

- Supabase email/password sign-in
- Persistent browser session
- Private RLS-controlled plant queries
- Live dashboard
- Search across all plant fields
- Individual plant pages
- NFC-ready URLs such as `?plant=HOYA-0001`
- Mobile-first design

## Supabase configuration

The app uses:

- Project URL: `https://igssrdlhxdmdwkuqpfrj.supabase.co`
- Browser-safe publishable key in `config.js`

The supplied URL originally ended in `/rest/v1/`. This package correctly uses the base project URL.

## Deploy by replacing repository files

1. Open your `orchard-collection` GitHub repository.
2. Upload all files from this package into the repository root.
3. Replace existing files when GitHub asks.
4. Commit the changes.
5. Cloudflare Pages should deploy automatically.

## Test

1. Open your Cloudflare Pages site.
2. Sign in with the Supabase user you created.
3. Confirm that 31 plants appear.
4. Open a card.
5. Test an NFC-style URL:

   `https://YOUR-SITE.pages.dev/?plant=HOYA-0001`

## Important

Do not put a Supabase secret key or service-role key in this repository. Only the publishable key belongs in browser code.

## Next database milestone

The next release can add one-tap care logging and photo uploads. Before building those features, verify the exact columns in `activity_log` and `photos`, since their insert payloads must match your database schema.
