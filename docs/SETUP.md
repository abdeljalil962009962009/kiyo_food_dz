# Kiyo Food — Production Setup Guide

Step-by-step, click-by-click setup for the external services the platform needs before you take the first real order. Written for a non-developer founder — every step says exactly which screen, which button, and which value to copy where.

> **Before you start**, have these accounts ready:
> - A Supabase project (the one whose URL is `https://rjdhzfcrsxibcszzlxyp.supabase.co`)
> - A Vercel account connected to the `kiyo_food_dz` GitHub repo
> - A personal Google account for Maps and Google sign-in configuration

---

## Table of Contents

1. [Resend password-reset email](#1-resend-password-reset-email-setup)
2. [Google Maps setup](#2-google-maps-setup)
3. [Sign in with Google](#3-sign-in-with-google)
4. [Where each value goes (cheat sheet)](#5-where-each-value-goes)
5. [Quick verification after every change](#6-quick-verification)

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

> You can use a subdomain (recommended for dev) or your root domain. The example below assumes `mail.kiyo-food.store`.

1. In Resend sidebar → click **Domains** → click **Add Domain**.
2. Type `kiyo-food.store` (or whatever your real domain is) → click **Add**.
3. Resend shows a list of DNS records you must add. They will look like:
   ```
   Type   Name                    Value
   -----   ---------------------   -------------------------------------
   TXT    resend._domainkey       [long string starting with k=rsa;…]
   TXT    @ (or your domain)      resend1._spf.resend.com or "v=spf1 …"
   CNAME  [varies]                [varies]
   ```
4. Open your domain registrar's dashboard (where you bought `kiyo-food.store` — probably Namecheap, GoDaddy, Cloudflare, OVH, etc.). Find the **DNS records** section for `kiyo-food.store`.
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
   - **Sender email**: `noreply@kiyo-food.store` (or whatever address you set up — must match the verified domain above)
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
3. Replace the HTML with the branded, scanner-safe template from `docs/supabase-auth-email-setup.md` (already in this repo — copy it verbatim). Do not replace its `TokenHash` link with `ConfirmationURL`.
4. Variables you may want to change: `Kiyo Food` text (top), the email subject, and the footer.
5. Click **Save**.

#### F. Tell Supabase which URLs are allowed

This is what makes the reset link in the email go somewhere real instead of being rejected.

1. Supabase → **Authentication** → **URL Configuration**.
2. **Site URL**: paste your production domain: `https://kiyo-food.store`.
3. **Redirect URLs** section → click **Add URL** and add one per line:
   ```
   https://kiyo-food.store/auth/callback
   https://kiyo-food.store/reset-password
   http://localhost:5173/auth/callback
   http://localhost:5173/reset-password
   ```
   (If you also have Vercel preview URLs, add `https://*-your-team.vercel.app/auth/callback` patterns.)
4. Click **Save**.

#### G. Test the flow

1. Open your **production** Vercel URL.
2. Click **Login** → click **Forgot password**.
3. Type a real email you control → click **Send reset link**.
4. Open that email inbox. You should see an email from `Kiyo Food <noreply@kiyo-food.store>` with subject "Reset your Kiyo Food password".
5. Click the orange **Reset password** button.
6. You land on `/reset-password`. The fragment-protected link remains unused until you explicitly submit the new password form. If an email client damages the link, enter the recovery code shown in the same email.
7. Type a new password → submit → you're redirected to `/login` and can log in.

#### Common mistakes

- ❌ **"Email not sent"** → the SMTP password is wrong, or the domain isn't verified. Check Resend → API Logs (you'll see the failure).
- ❌ **"Invalid redirect URL"** → you forgot to add the URL in step F.
- ❌ **Email arrives but link is broken** → your **Site URL** in step F doesn't match where Vercel actually serves the app. Check the browser bar.
- ❌ **Email goes to spam** → you probably skipped the `SPF`/`DKIM` DNS records. Add all of them.

---

## 2. Google Maps setup

**Production architecture:** Google Maps Platform is the primary map, address search, geocoding, and route provider. The browser Geolocation API supplies coordinates; Google never replaces a weak GPS reading with an IP-derived delivery point. OpenStreetMap/Nominatim remains a limited text-geocoding fallback in `src/lib/geo.ts`, not the primary interactive map.

> Google Maps requires a billing-enabled Google Cloud account. Keep quotas, budget alerts, HTTP-referrer restrictions, and API restrictions enabled.

#### 1. Google Cloud project

1. Open **https://console.cloud.google.com/**.
2. Top bar → click the project dropdown → **New Project** → name it `kiyo-food-maps` → **Create**.
3. Wait for the project to be created and switch into it.

#### 2. Enable the required APIs

In the left menu → **APIs & Services** → **Library**. Search for and **Enable** each of:
- **Maps JavaScript API**
- **Places API (New)**
- **Geocoding API**
- **Directions API** (for delivery routes and ETA)

#### 3. Create an API key

1. **APIs & Services** → **Credentials** → **Create Credentials** → **API Key**.
2. Copy the key (looks like `AIzaSy…`). Click **Edit Key** to restrict it:
    - **Application restrictions**: HTTP referrers (web sites). Add:
      ```
      https://kiyo-food.store/*
      https://www.kiyo-food.store/*
      https://*.vercel.app/*
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

#### 5. Create a production map ID (recommended)

1. Google Cloud → **Google Maps Platform** → **Map Management** → **Create map ID**.
2. Choose **JavaScript** and the vector map type.
3. Add the generated value in Vercel as `VITE_GOOGLE_MAPS_MAP_ID`.
4. Redeploy. The app already contains the complete Google Maps integration and uses `DEMO_MAP_ID` only when this optional value is absent.

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
     https://kiyo-food.store
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
   https://kiyo-food.store/auth/callback
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
3. The browser opens Google's secure sign-in page. Pick a Google account.
4. First time: Google's consent screen asks you to allow Kiyo Food → click **Allow**.
5. New Google users land on `/complete-profile`, where a valid Algerian mobile number is required before app access. Returning users with a valid saved number land on `/dashboard`.

#### Common mistakes

- ❌ **"redirect_uri_mismatch"** → the redirect URI in Google Cloud does not match the one Supabase generates. The correct value is `https://YOUR_PROJECT.supabase.co/auth/v1/callback` — your **Supabase project URL**, not your Vercel URL.
- ❌ **"Access blocked: this app's request is invalid"** → you skipped OAuth consent screen setup.
- ❌ **Sign-in returns to the login page** → verify both the Supabase redirect allow-list and the Google Cloud Supabase callback URI above. Kiyo Food uses a full-page OAuth redirect so popup blockers do not interrupt mobile sign-in.
- ❌ **Works locally but not in production** → you forgot to add the production Vercel domain to "Authorized JavaScript origins" in Google Cloud.

---

## 4. Sign in with Apple (removed)

Kiyo Food does not offer Apple sign-in. The login UI and client authentication
flow intentionally support Google plus email/password only. Keep the Apple
provider disabled in Supabase so the operator configuration matches the app.

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
| Google Maps JavaScript API key | Google Cloud → Credentials | Vercel env `VITE_GOOGLE_MAPS_API_KEY` |
| Google Maps map ID | Google Maps Platform → Map Management | Vercel env `VITE_GOOGLE_MAPS_MAP_ID` |
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
5. **If something breaks**, check **Supabase → Auth → Logs** for the request trace. That's where errors land.

If you get stuck, the logs are your friend. Both Supabase and Resend have very good log dashboards.
