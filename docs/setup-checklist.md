# Setup Checklist

One-time work to stand up the dashboard. Walk through in order.

## 1. Create a Google Cloud service account

1. Go to https://console.cloud.google.com/.
2. Create a new project (or reuse an existing one) — e.g. `zoodealio-dashboard`.
3. APIs & Services → **Enable** the **Google Sheets API** for the project.
4. IAM & Admin → Service Accounts → **Create service account**.
5. Name it `zoodealio-dashboard-reader`. Skip role assignment (we'll grant access directly on the sheets).
6. Open the new service account → **Keys → Add key → Create new key → JSON**. Download the JSON file somewhere safe.
7. Note the service account email — it looks like `zoodealio-dashboard-reader@<project>.iam.gserviceaccount.com`.

## 2. Share the two sheets with the service account

Open each sheet, click **Share**, paste the service account email, set access to **Viewer**, uncheck "Notify people", click **Share**:

- [Joseph - Tracking](https://docs.google.com/spreadsheets/d/17QTyDys-e4fossUY5PcGNFZtJdrzDrWkzAdrVXiEN9Q/edit)
- [2026 Escrows and Closings](https://docs.google.com/spreadsheets/d/1hu6Zd2uAOpiVjBls1tyBHXyM1RAHRw9qMEwnUF_wtAY/edit)

## 3. Configure Vercel

1. From the project directory: `npx vercel link` and choose the `zoodealio-dashboard` project (create it if it doesn't exist — default URL becomes `zoodealio-dashboard.vercel.app`).
2. In the Vercel UI → Settings → Environment Variables, add these two for Production + Preview + Development:
   - `GOOGLE_SERVICE_ACCOUNT_EMAIL` → the service account email from step 1.
   - `GOOGLE_SERVICE_ACCOUNT_KEY` → the value of the `private_key` field from the downloaded JSON (includes the `-----BEGIN PRIVATE KEY-----` header and `-----END PRIVATE KEY-----` footer).
3. Deploy: `npx vercel deploy --prod`.

## 4. Password-gate the deployment

Vercel → Project → Settings → **Deployment Protection** → enable **Password Protection**. Share the password with anyone who needs to open the dashboard from outside the office.

## 5. Kiosk mode on the mini-PC

On the mini-PC driving the 65" TV, create an autostart shortcut that launches Chrome in kiosk mode pointed at the dashboard:

**Windows**

```
"C:\Program Files\Google\Chrome\Application\chrome.exe" --kiosk --app=https://zoodealio-dashboard.vercel.app --noerrdialogs --disable-infobars --disable-session-crashed-bubble
```

**macOS**

```
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --kiosk --app=https://zoodealio-dashboard.vercel.app
```

Additional OS tweaks: disable display sleep, disable auto-update prompts, add the shortcut to system login items / Task Scheduler so it relaunches after reboot.

## 6. Drop in the brand assets

Once the Zoodealio asset pack is ready (Zee pose variants, custom icons for acquisition/resale closed tiles, etc.), drop the SVGs into `public/assets/` with filenames matching the slots listed in `public/assets/README.md`. No code changes needed.

## 7. Verify on the real TV

Final sanity pass once the dashboard is live:

- Numbers match what the sheets say.
- Goal bar is counting both sides toward the 30/month target.
- Celebrations fire on test increases (simulate by editing a sheet cell).
- Dashboard is legible from across the office (font sizes / spacing look right on the 65" at actual resolution).
