# Kiyo Food — Production Setup Guide

Step-by-step, click-by-click setup for the four external services the platform needs before you take the first real order. Written for a non-developer founder — every step says exactly which screen, which button, and which value to copy where.

> **Before you start**, have these accounts ready:
> - A Supabase project (the one whose URL is `https://rjdhzfcrsxibcszzlxyp.supabase.co`)
> - A Vercel account connected to the `kiyo_food_dz` GitHub repo
> - (For Google + Apple) A personal Google account and an Apple Developer account ($99/yr, required for Apple)

---

## Table of Contents

1. [Resend password-reset email](#1-resend-password-reset-email-setup)
2. [Google Maps setup](#2-google-maps-setup)
3. [Sign in with Google](#3-sign-in-with-google)
4. [Sign in with Apple](#4-sign-in-with-apple)
5. [Where each value goes (cheat sheet)](#5-where-each-value-goes)
6. [Quick verification after every change](#6-quick-verification)

---

## 1. Resend password-reset email setup

**What this does:** When a customer hits "Forgot password" on the login page, this is the email that gets sent to them. By default Supabase has a generic developer email. Resend gives you a properly branded email from your own domain.

> Resend is "just" the SMTP server. We don't write app code against it — Supabase's auth uses it under the hood. So all configuration is in **two dashboards**: resend.com and supabase.com.

### Step-by-step

#### A. Resend account

1. Open **https://resend.com** and click **Sign Up** (top-right).
2. Create your account (email + password, or continue with Google).
3. Once logged in, you land on **Domains** in the left sidebar.

#### B. Add and verify your sending domain

> You can use a subdomain (recommended for dev) or your root domain. The example below assumes `mail.kiyo.food`.

1. In Resend sidebar → click **Domains** → click **Add Domain**.
2. Type `kiyo.food` (or whatever your real domain is) → click **Add**.
3. Resend shows a list of DNS records you must add. They will look like:
   ```
   Type   Name                    Value
   -----   ---------------------   -------------------------------------
   TXT    resend._domainkey       [long string starting with k=rsa;…]
   TXT    @ (or your domain)      resend1._spf.resend.com or "v=spf1 …"
   CNAME  [varies]                [varies]
   ```
4. Open your domain registrar's dashboard (where you bought `kiyo.food` — probably Namecheap, GoDaddy, Cloudflare, OVH, etc.). Find the **DNS records** section for `kiyo.food`.
5. Add **each** DNS record exactly as shown. Use the copy-paste buttons in Resend.
6. Go back to Resend → click the **Verify** button next to your domain. DNS can take a few minutes to a few hours to propagate. Click verify periodically; once it works, the status turns green and says "Verified".
7. *(Skip this if you're only testing locally for now — the steps that follow work with the unverified domain too, just in a "sandbox" mode where Resend only sends to your own address.)*

#### C. Create a Resend API key

1. Resend sidebar → click **API Keys** → click **Create API Key**.
2. Name it `Kiyo Food – Production` (or similar).
3. Permission: **Full access** (you can restrict later, but for now keep it simple).
4. Click **Add** → Resend shows the key **once**, like `re_AbCdEf123…`. **Copy it now and paste it somewhere safe** (password manager, 1Password, etc.). You will not see it again.

#### D. Wire Resend into Supabase

1. Open **https://supabase.com/dashboard** → click into your Kiyo Food project.
2. In the left sidebar → click **Authentication** (key icon).
3. Click the sub-tab **SMTP Settings** (sometimes called "Email" or under Auth → Sign In/Up → Email).
4. Toggle **Enable Custom SMTP** to ON.
5. Fill the form with exactly these values:
   - **Sender email**: `noreply@kiyo.food` (or whatever address you set up — must match the verified domain above)
   - **Sender name**: `Kiyo Food`
   - **Host**: `smtp.resend.com`
   - **Port**: `465`
   - **Username**: `resend`
   - **Password**: paste the `re_AbCdEf123…` API key from step C
   - **Secure (TLS)**: ON
6. Click **Save**.
7. Supabase will save. A green banner confirms SMTP is configured.

#### E. Brand the password-reset email template

1. Still in Supabase → **Authentication** → click **Email Templates** (under "Auth" sub-section).
2. Click **Reset Password** in the list of templates.
3. Replace the HTML with the branded template from `docs/supabase-auth-email-setup.md` (already in this repo — copy it verbatim).
4. Variables you may want to change: `Kiyo Food` text (top), the email subject, and the footer.
5. Click **Save**.

#### F. Tell Supabase which URLs are allowed

This is what makes the reset link in the email go somewhere real instead of being rejected.

1. Supabase → **Authentication** → **URL Configuration**.
2. **Site URL**: paste your production Vercel domain, e.g. `https://kiyo-food.vercel.app` (or `https://kiyo.food` once you point your domain at Vercel — see step G).
3. **Redirect URLs** section → click **Add URL** and add one per line:
   ```
   https://your-vercel-domain.vercel.app/auth/callback
   https://your-vercel-domain.vercel.app/auth/reset
   http://localhost:5173/auth/callback
   http://localhost:5173/auth/reset
   ```
   (If you also have Vercel preview URLs, add `https://*-your-team.vercel.app/auth/callback` patterns.)
4. Click **Save**.

#### G. Test the flow

1. Open your **production** Vercel URL.
2. Click **Login** → click **Forgot password**.
3. Type a real email you control → click **Send reset link**.
4. Open that email inbox. You should see an email from `Kiyo Food <noreply@kiyo.food>` with subject "Reset your Kiyo Food password".
5. Click the orange **Reset password** button.
6. You land on `/auth/reset`, which automatically forwards to the in-app password-reset screen.
7. Type a new password → submit → you're redirected to `/login` and can log in.

#### Common mistakes

- ❌ **"Email not sent"** → the SMTP password is wrong, or the domain isn't verified. Check Resend → API Logs (you'll see the failure).
- ❌ **"Invalid redirect URL"** → you forgot to add the URL in step F.
- ❌ **Email arrives but link is broken** → your **Site URL** in step F doesn't match where Vercel actually serves the app. Check the browser bar.
- ❌ **Email goes to spam** → you probably skipped the `SPF`/`DKIM` DNS records. Add all of them.

---

## 2. Google Maps setup

**Important — read first:** The current production build uses **Leaflet + OpenStreetMap** (free, no API key required). The repo's `src/lib/geo.ts` and `src/components/DeliveryMap.tsx` call `nominatim.openstreetmap.org` directly. **You do not need any Google Maps setup to launch the app as it is today.**

What Google Maps would give you if you switched:
- Better satellite imagery
- More accurate local data in Algeria
- Commercial-grade routing (the current ETA is estimated in code)
- Costs: **pay per request** — can become significant at scale (≈$7 per 1,000 map loads + Places API calls)

**Choose one of two paths below.**

### Option A — Keep the free OSM/Leaflet setup (recommended for MVP)

1. **Nothing to do.** The app already works.
2. To verify: open your production URL → go to `/restaurant/apply` as an owner → click the map. You can drag the pin, search addresses in Algeria, and the location saves.
3. If the search is slow or shows "Rate limited", that means Nominatim (public server) is throttled. Fix that by hosting your own Nominatim instance OR by switching to Mapbox (also has a generous free tier). Out of scope for this doc.

### Option B — Switch to Google Maps Platform

> ⚠️ Requires a billing-enabled Google Cloud account. Maps JavaScript API + Places API together cost about **$7 per 1,000 loads** after the free monthly credit.

#### 1. Google Cloud project

1. Open **https://console.cloud.google.com/**.
2. Top bar → click the project dropdown → **New Project** → name it `kiyo-food-maps` → **Create**.
3. Wait for the project to be created and switch into it.

#### 2. Enable the required APIs

In the left menu → **APIs & Services** → **Library**. Search for and **Enable** each of:
- **Maps JavaScript API**
- **Places API**
- **Geocoding API**
- **Distance Matrix API** (for driver ETA if you use Google's ETA)

#### 3. Create an API key

1. **APIs & Services** → **Credentials** → **Create Credentials** → **API Key**.
2. Copy the key (looks like `AIzaSy…`). Click **Edit Key** to restrict it:
   - **Application restrictions**: HTTP referrers (web sites). Add:
     ```
     https://your-vercel-domain.vercel.app/*
     http://localhost:5173/*
     ```
   - **API restrictions**: restrict to the four APIs you just enabled.
3. Click **Save**.

#### 4. Add the key to Vercel

1. Open **https://vercel.com/dashboard** → click into the `kiyo_food_dz` project.
2. **Settings** → **Environment Variables** → **Add**.
3. **Key**: `VITE_GOOGLE_MAPS_API_KEY`
4. **Value**: paste the `AIzaSy…` key.
5. Tick all three environments (Production, Preview, Development).
6. **Save** → go to the **Deployments** tab → click the three-dot menu on the latest → **Redeploy** (this rebuilds the bundle with the new env var).

#### 5. Code change required (not free, not automatic)

> This requires developer time — the frontend does not currently use Google Maps. You would swap `src/components/DeliveryMap.tsx` and `src/lib/geo.ts` to call Google instead of Nominatim. Expect 4–8 hours of work plus QA in Algeria. Not recommended until revenue justifies the cost.

#### Common mistakes

- ❌ **"This page didn't load Google Maps correctly"** → API key missing, restricted to wrong referrer, or billing not enabled.
- ❌ **"REQUEST_DENIED"** → you missed enabling one of the four APIs.
- ❌ **Big bill surprise** → you didn't restrict the key. Anyone can take your key and rack up costs; **always** set HTTP-referrer restrictions.

---

## 3. Sign in with Google

**What this does:** Adds the "Continue with Google" button on the login page. Supabase handles the OAuth handshake — your job is to register the app with Google and tell Supabase the keys.

### Step-by-step

#### A. Google Cloud: create OAuth client

1. Open **https://console.cloud.google.com/** → into your project (create one if you don't have one yet — same project as Maps is fine).
2. Left menu → **APIs & Services** → **OAuth consent screen**.
   - User type: **External** → **Create**.
   - Fill: App name `Kiyo Food`, support email = your Gmail.
   - Scopes: leave defaults, click **Save and Continue** through each step.
   - **Test users**: add your Gmail + any team members' emails (so you can log in before verification).
   - **Back to Dashboard**.
3. Left menu → **APIs & Services** → **Credentials** → **Create Credentials** → **OAuth client ID**.
   - Application type: **Web application**.
   - Name: `Kiyo Food Web`.
   - **Authorized JavaScript origins** → **Add URI**:
     ```
     https://your-vercel-domain.vercel.app
     http://localhost:5173
     ```
   - **Authorized redirect URIs** → **Add URI**:
     ```
     https://rjdhzfcrsxibcszzlxyp.supabase.co/auth/v1/callback
     ```
     > ⚠️ This is **NOT** your Vercel domain — it's your **Supabase project URL** with `/auth/v1/callback` appended. Supabase is the OAuth handler; Google redirects to Supabase, Supabase redirects back to your app. This is the most-forgotten step.
   - Click **Create**.
4. A modal pops up with **Client ID** and **Client Secret**. Copy both.

#### B. Plug into Supabase

1. Supabase Dashboard → **Authentication** → **Providers** (or **Sign In/Up** → **Providers**).
2. Find **Google** in the list of providers → click to expand.
3. Toggle **Enable** to ON.
4. Paste:
   - **Client ID**: the `…apps.googleusercontent.com` string
   - **Client Secret**: the random string Google gave you
5. **Authorized Client IDs**: leave default unless your team has a separate OAuth client they use for testing.
6. **Skip nonce check**: OFF (keep it off unless Supabase tells you otherwise).
7. Click **Save**.

#### C. Make sure the redirect URL is allowed

Already covered in step 1F above, but double-check:

1. Supabase → **Authentication** → **URL Configuration** → **Redirect URLs**:
   ```
   https://your-vercel-domain.vercel.app/auth/callback
   http://localhost:5173/auth/callback
   ```
2. Save.

#### D. Verify the consent screen is "In production" (after testing)

For production launch, your OAuth consent screen must be **Published**, otherwise only the emails in "Test users" can log in. To publish:

1. Google Cloud → **APIs & Services** → **OAuth consent screen**.
2. Click **Publish App** → confirm.
3. Google may require a verification step (logo, privacy policy URL, etc.). Submit when prompted; review typically takes a few days to a few weeks.

You can launch WITHOUT publishing as long as every user is on your "Test users" list — but this gets painful fast. Add all known team emails before launch.

#### E. Test it

1. Open your production URL → **/login**.
2. Click **Continue with Google**.
3. A popup opens (or full redirect on mobile). Pick a Google account.
4. First time: Google's consent screen asks you to allow Kiyo Food → click **Allow**.
5. You land back in the app at `/dashboard`, signed in.

#### Common mistakes

- ❌ **"redirect_uri_mismatch"** → the redirect URI in Google Cloud does not match the one Supabase generates. The correct value is `https://YOUR_PROJECT.supabase.co/auth/v1/callback` — your **Supabase project URL**, not your Vercel URL.
- ❌ **"Access blocked: this app's request is invalid"** → you skipped OAuth consent screen setup.
- ❌ **Popup blocked** → the app opens a popup; some browsers block it. The frontend surfaces a "Popup was blocked" error in this case (look in the UI for a banner).
- ❌ **Works locally but not in production** → you forgot to add the production Vercel domain to "Authorized JavaScript origins" in Google Cloud.

---

## 4. Sign in with Apple

**This is the hardest of the four.** Apple requires three things that the others don't: a paid Apple Developer account, a "Services ID" (not the App ID), and a private key you use to sign a JWT client secret. Below is the full click-by-click.

> ⚠️ Apple charges $99/year for a developer account. If you don't have one yet, you can skip this for MVP and enable later — the rest of the app works fine.

### Step-by-step

#### A. Apple Developer account

1. Open **https://developer.apple.com/** → **Account** → sign in with your Apple ID (create one if you need to).
2. Pay the $99/year fee (this is required before you can do anything below).
3. Once you're a member, go to **https://developer.apple.com/account/resources/certificates/list** — this is where you'll do all the work.

#### B. Create a Services ID (this is *not* your app's Bundle ID)

1. Top nav → **Certificates, Identifiers & Profiles** → **Identifiers**.
2. Top-right → click the **+** button.
3. Choose **Services IDs** → click **Continue**.
4. Fill:
   - **Description**: `Kiyo Food Web`
   - **Identifier**: must be a reverse-DNS string. Convention: `com.kiyofood.web` (must be unique; pick something matching your Apple Developer team's domain convention).
5. Click **Continue** → **Register**.

#### C. Enable Sign in with Apple on the Services ID

1. Still on the **Identifiers** page → click your new Services ID.
2. Tick the box **Sign in with Apple** → click **Configure**.
3. **Primary App ID**: select your team's main iOS App ID. If you don't have one yet, create one quickly (Identifiers → App IDs → + → App → Bundle ID = `com.kiyofood.app`).
4. **Domains**: add your Vercel domain AND Supabase callback domain (one per line):
   ```
   your-vercel-domain.vercel.app
   rjdhzfcrsxibcszzlxyp.supabase.co
   ```
5. **Return URLs**: paste the Supabase callback URL:
   ```
   https://rjdhzfcrsxibcszzlxyp.supabase.co/auth/v1/callback
   ```
6. Click **Save** → **Continue** → **Save** again on the Identifiers screen.

#### D. Generate the private key

1. Still in **Certificates, Identifiers & Profiles** → **Keys** (left column).
2. Top-right → click the **+** button.
3. **Key Name**: `Kiyo Food Web Key`.
4. Tick **Sign in with Apple** → click **Configure** → select your primary App ID (same one as step C.3) → **Save**.
5. Click **Continue** → **Register**.
6. **Download the .p8 file NOW.** Save it somewhere safe — you cannot download it again. The file is named `AuthKey_ABCDEFGHIJ.p8` (the ABC… is your Key ID, copy it down).
7. Also note your **Team ID**: top-right of any developer.apple.com page → your name → copy "Team ID" (10-character alphanumeric string).

#### E. Generate the Apple client secret (this is the unusual step)

> Supabase needs the client secret, but Apple requires you to **sign a JWT yourself** using the .p8 key. You do this ONCE, then paste the resulting JWT into Supabase (it expires after 6 months, so you'll need to repeat).

**Easiest method:** Run this Python script (or the equivalent Node.js version) on your laptop, AFTER installing the .p8 file.

1. Get Python 3 (already on macOS) or install: https://www.python.org/downloads/
2. Save this as `gen_apple_secret.py`:
   ```python
   import jwt, time, uuid
   # pip install PyJWT cryptography
   team_id   = "ABCDE12345"          # from step D.7
   service_id = "com.kiyofood.web"   # from step B.4
   key_id    = "ABCDEFGHIJ"          # from step D.6 (the .p8 file's prefix)
   with open("AuthKey_ABCDEFGHIJ.p8", "r") as f:
       private_key = f.read()

   now = int(time.time())
   headers = {"kid": key_id, "alg": "ES256"}
   payload = {
       "iss": team_id,
       "iat": now,
       "exp": now + 60*60*24*180,           # 180 days max
       "aud": "https://appleid.apple.com",
       "sub": service_id,
   }
   token = jwt.encode(payload, private_key, algorithm="ES256", headers=headers)
   print(token)
   ```
3. Run: `python3 gen_apple_secret.py`
4. It prints a very long JWT string (~700 characters). Copy it.

> **Repeat every 6 months.** Set a calendar reminder for the day before `exp`. Apple won't warn you; users will suddenly get "invalid_client" errors.

#### F. Plug into Supabase

1. Supabase → **Authentication** → **Providers** → find **Apple** → click to expand.
2. Toggle **Enable** to ON.
3. Paste:
   - **Client ID**: the Services ID from step B.4, e.g. `com.kiyofood.web`
   - **Client Secret**: the long JWT from step E.4
   - **Team ID**: from step D.7
   - **Key ID**: from step D.6
4. Toggle **Enable Sign in with Apple (Native)** OFF (this is for iOS apps, not web).
5. Click **Save**.

#### G. Verify the redirect URL again

Same as for Google — make sure `/auth/callback` is in your Supabase **URL Configuration → Redirect URLs**.

#### H. Test

1. Production URL → **/login** → **Continue with Apple**.
2. First time: Apple shows a sign-in popup (or full-page on mobile). Sign in with your Apple ID.
3. Apple asks if you want to share your real email or use a private relay (`@privaterelay.appleid.com`) — customer chooses.
4. Click **Continue** — you land back in the app at `/dashboard`.

#### Common mistakes

- ❌ **"invalid_client"** → JWT is wrong or expired. Regenerate (step E).
- ❌ **"redirect_uri_mismatch"** → your Return URL (step C.5) or Supabase's Redirect URLs (step G) don't match what's on the other side.
- ❌ **"Sign in with Apple is not configured"** → you forgot to click **Configure** on the Services ID in step C.
- ❌ **Works on iPhone Safari but not Chrome desktop** → Apple web sign-in sometimes misbehaves when the popup is opened cross-window. The popup code in `AuthContext.tsx` has fallback logic, but Chrome users might need to enable third-party cookies for `appleid.apple.com`.
- ❌ **I can't find a Services ID option** → your Apple Developer account isn't paid, or you're in the wrong team. Sign out, sign back in.

---

## 5. Where each value goes

| Value | Where it comes from | Where it goes |
|---|---|---|
| Supabase URL | Supabase → Project → Settings → API | Vercel env `VITE_SUPABASE_URL`, and `.env.local` for dev |
| Supabase anon key | Supabase → Project → Settings → API | Vercel env `VITE_SUPABASE_ANON_KEY`, and `.env.local` |
| Resend API key | resend.com → API Keys | Supabase → Auth → SMTP Settings (password field) |
| Resend sender domain | resend.com → Domains | DNS records at your domain registrar |
| Google OAuth Client ID | Google Cloud → Credentials | Supabase → Auth → Providers → Google |
| Google OAuth Client Secret | Google Cloud → Credentials | Supabase → Auth → Providers → Google |
| Google Maps JavaScript API key | Google Cloud → Credentials | Vercel env `VITE_GOOGLE_MAPS_API_KEY` *(only if switching from OSM)* |
| Apple Services ID | developer.apple.com | Supabase → Auth → Providers → Apple |
| Apple Key ID | developer.apple.com | Supabase → Auth → Providers → Apple |
| Apple Team ID | developer.apple.com (top-right) | Supabase → Auth → Providers → Apple |
| Apple .p8 private key | developer.apple.com | Run locally to sign a JWT, paste JWT into Supabase |
| All redirect URLs | n/a (you choose) | Supabase → Auth → URL Configuration → Redirect URLs |

---

## 6. Quick verification after every change

After touching any of the four setups:

1. **Vercel**: if you changed any Vercel env var, wait for the auto-redeploy to finish (check **Deployments** tab → status "Ready"). If you changed Supabase config, no rebuild is needed — go straight to step 2.
2. **In a real browser** (not just incognito), open your production URL.
3. **Hard refresh**: Ctrl+Shift+R (Win/Linux) / Cmd+Shift+R (Mac) — bypasses service-worker cache.
4. **Run through each flow** you changed:
   - Email → Request password reset → check inbox → click link → set new password → log in
   - Google → Click button → choose account → land in dashboard
   - Apple → Click button → choose Apple ID → land in dashboard
5. **If something breaks**, check **Supabase → Auth → Logs** for the request trace. That's where errors land.
6. **For Apple specifically**, if it silently fails, check that the JWT hasn't expired (max 6 months).

If you get stuck, the logs are your friend. Both Supabase and Resend have very good log dashboards.
