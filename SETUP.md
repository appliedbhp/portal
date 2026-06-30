# Client Portal — Setup

## 1. Deploy the Apps Script backend
1. Open the Google Sheet, then **Extensions > Apps Script**.
2. Delete the default `Code.gs` content and paste in the contents of `../apps-script/Code.gs`.
3. Add the `DATE_ASSESSMENT` column to the `data_win` sheet (header row), if not already present.
4. **Deploy > New deployment > Web app**. Set "Execute as: Me" and "Who has access: Anyone". Deploy and copy the Web App URL.
5. Paste that URL into `js/api.js`, replacing `PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE`.

## 2. Test the backend directly
```bash
curl -X POST "YOUR_WEB_APP_URL" \
  -H "Content-Type: text/plain;charset=utf-8" \
  -d '{"action":"verifyClient","licenseKey":"123456789","clientId":"C-EXAMPLE","pin":"12345"}'
```
Should return `{"ok":true}`. Try `C-EXAMPLE2` (inactive license) and confirm it's rejected.

## 3. Host the portal
Push this `portal/` folder to a GitHub repo and enable GitHub Pages (Settings > Pages > deploy from branch). Your login page will be at `https://<you>.github.io/<repo>/login.html`.

## 4. Lock down the Sheet
Once steps 1–3 are verified end-to-end, change the Sheet's sharing to **private** (only you). The Apps Script Web App keeps working regardless, since it runs under your account.
