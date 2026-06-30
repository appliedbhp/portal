# Client Portal — Setup

## 1. Sheet changes (do these before redeploying Code.gs)
- `tbl_license`: confirm `SALT` column exists (next to `PASS`); add a new `ROLE` column with value `provider` or `parent` for each client row.
- `tbl_plan`: add a `GOAL_ID` column (any header position is fine — the script finds columns by name).
- `tbl_plan` `OBJ_TEXT` column: replace the per-row formula with a single `ARRAYFORMULA` in row 2 that covers the whole column (referencing `GOAL_DOMAIN`/`OBJECTIVE` etc.), so new rows added by the portal pick it up automatically without the script writing to that cell.
- `data_win`: confirm the `DATE_ASSESSMENT` column exists (added in the first build).
- **New `tbl_providers` sheet** — one row per provider/clinician who should be able to log in and access *any* client by Client ID. Columns: `PROVIDER_ID`, `LICENSE_KEY`, `PIN`, `SALT`, `PASS`, `ACTIVE`. Fill in `PROVIDER_ID` (a username, e.g. your name or email), `LICENSE_KEY`, a 5-digit `PIN`, and `ACTIVE` = `TRUE` for each provider; leave `SALT`/`PASS` blank — they're filled in automatically on first login. This is separate from `tbl_license`, which is per-client.

## 2. Deploy the Apps Script backend
1. Open the Google Sheet, then **Extensions > Apps Script**.
2. Replace `Code.gs` with the contents of `../apps-script/Code.gs`.
3. **Deploy > Manage deployments > Edit (pencil) > New version > Deploy** (re-deploying a *new version* is required after code changes — just saving isn't enough for the live Web App URL to pick up changes).
4. The Web App URL stays the same across versions, so `js/api.js`'s `API_URL` doesn't need to change after the first deploy.

## 3. Test the backend directly
```bash
# First-time setup
curl -X POST "YOUR_WEB_APP_URL" -H "Content-Type: text/plain;charset=utf-8" \
  -d '{"action":"setupPassword","clientId":"C-EXAMPLE","licenseKey":"123456789","pin":"12345","newPassword":"testpass123"}'

# Returning login
curl -X POST "YOUR_WEB_APP_URL" -H "Content-Type: text/plain;charset=utf-8" \
  -d '{"action":"login","clientId":"C-EXAMPLE","password":"testpass123"}'
```
Both should return `{"ok":true,"role":"provider"}` (or `"parent"`, depending on the ROLE column). Confirm a wrong password and an inactive client (`C-EXAMPLE2`) are rejected.

## 4. Host on Cloudflare Pages (portal.getadhd.care)
1. Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect to Git**, select `appliedbhp/portal`.
2. Build settings: no build command, output directory `/` (static files, no build step).
3. After the first deploy, go to the project's **Custom domains** tab → **Add domain** → `portal.getadhd.care`. Cloudflare auto-creates the DNS record if the `getadhd.care` zone is already on this account.
4. Once `https://portal.getadhd.care/login.html` works, you can turn off GitHub Pages (repo Settings → Pages → Source: None) to avoid having two live copies.

## 5. Lock down the Sheet
Once everything above is verified end-to-end, change the Sheet's sharing to **private** (only you). The Apps Script Web App keeps working regardless, since it runs under your account.
