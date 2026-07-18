# Orchard Collection v4.2.2 — Label Controls Fix

This package fixes the real root cause: the label buttons in v4.2.1 called
functions that did not exist.

- Save PNG works
- Print Label works
- Plant name, accession, and location are editable
- Preview updates live
- Reset restores plant data
- Safari pop-up blocking is handled correctly
- Preview, PNG, and print still use the same 300-DPI renderer

Deploy the full ZIP to Cloudflare Pages, refresh the site once in Safari, then
fully close and reopen the installed app.
