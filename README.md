# Orchard Collection Web App

## Upload to GitHub
1. Unzip this download.
2. Open your `orchard-collection` repository on GitHub.
3. Choose **Add file → Upload files**.
4. Drag in every file and folder from inside the unzipped folder.
5. Click **Commit changes**.

## Deploy on Cloudflare Pages
Return to Cloudflare, refresh the repository list, select `orchard-collection`, and use:
- Framework preset: **None**
- Build command: leave blank
- Build output directory: `/`

## NFC URL format
After deployment, each tag should contain:
`https://YOUR-SITE.pages.dev/plant.html?id=HOYA-0001`

Change the accession number for each plant.

## Permanent updates
Edit `data/plants.json` in GitHub. Each commit triggers a new Cloudflare deployment.

## Photos
Upload files into a new `assets/photos` folder. Set `heroPhoto` in `plants.json` to:
`assets/photos/HOYA-0001.jpg`

## Important
Do not permanently lock NFC tags until your final Cloudflare or custom domain works and has been tested.
