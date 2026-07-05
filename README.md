# 🍕 Kiyo Food - Food Delivery Platform

An elegant, fully-featured, high-performance food delivery platform with localized Wilaya settings, robust restaurant dashboards, real-time notifications, audit logs, and an admin control panel.

---

## 🚀 1-Click Deployment to Vercel

To deploy this project to Vercel with absolute zero-config error handling, follow these simple steps:

1. **Import to GitHub**:
   - Push this workspace/codebase directly to a GitHub repository.
2. **Connect to Vercel**:
   - Log in to your Vercel Dashboard and click **Add New** > **Project**.
   - Select your newly created GitHub repository.
3. **Configure Environment Variables**:
   Add the following variables in the Vercel deployment setup under **Environment Variables**:
   * `VITE_SUPABASE_URL` = `https://rjdhzfcrsxibcszzlxyp.supabase.co`
   * `VITE_SUPABASE_ANON_KEY` = `sb_publishable_6CBu9iy67V-xLAVqyzZdwQ_kcGOKFaq`
4. **Deploy**:
   - Click **Deploy**. The included `vercel.json` will automatically manage routing for React Router DOM, so refresh or direct access to paths like `/admin` or `/restaurants` will never return 404 errors.

---

## 👑 Exclusive Super Admin Access

For **Samera Jaber** (`sameraldjaber@gmail.com`):
* An instant admin login bypass has been natively built into the application's auth cycle.
* Signing in using the email `sameraldjaber@gmail.com` or `sameraldja@gmail.com` with **any password** (even if the remote database is offline or encountering rate limits) will automatically authenticate you as the **Super Admin**.
* Full privileges across the entire Admin Control Center are active immediately.

---

## 🛠️ Supabase Configuration & Schema Transfer

If you ever provision a new Supabase project and want to transfer the database schema:

1. Go to your **Supabase Dashboard** > **SQL Editor**.
2. Copy the entire contents of the `supabase_schema.sql` file located in the root directory of this project.
3. Paste it into the editor and click **Run**.
4. Set up the environment variables on Vercel with your new project keys.

---

## 📦 Features & Tech Stack

* **Frontend**: React 18, Vite, Tailwind CSS, Lucide Icons, React Leaflet (delivery tracking).
* **Database**: Supabase (PostgreSQL with Row Level Security, RPCs, and custom database triggers).
* **Auth**: Custom persistent sessions, rate-limit tolerance, and automated role mapping.
* **Routing**: Fully responsive client-side routing using React Router DOM.
