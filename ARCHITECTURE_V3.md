# Orchard Collection Professional v3 Architecture

This release begins the modular migration without breaking the working Supabase application.

## New module boundaries
- `src/components` — reusable UI primitives
- `src/screens` — dashboard, collection, plant, labels, settings
- `src/services` — application services
- `src/printer` — Brother QL-820NWB integration layer
- `src/labels` — label templates and renderer
- `src/analytics` — metrics and reporting
- `src/database` — Supabase queries and repositories
- `src/utils` — shared helpers

The current `app.js` remains the compatibility entry point. Features will be moved into these folders release by release so existing data and workflows continue to work.
