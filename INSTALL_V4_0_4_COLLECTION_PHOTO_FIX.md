# Orchard Collection v4.0.4 — Collection Photo Fix

## Bug fixed

Plant photos appeared correctly on the individual plant page but disappeared
from cards in the Plants collection.

A professional-theme CSS rule used the `background` shorthand with `!important`.
That shorthand replaced the inline `background-image` URL used by each plant
card. The rule now changes only `background-color`, allowing the plant photo to
remain visible.

## Deploy

Upload the complete contents of this ZIP to the existing Cloudflare Pages
project. The stylesheet URL and service-worker cache have both been advanced to
v4.0.4.

After deployment, close and reopen the installed app. If an older cached view
remains, refresh `app.orchardcollection.ca` once in Safari.
