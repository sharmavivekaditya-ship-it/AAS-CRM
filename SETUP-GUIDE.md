# AAS BD Desk: setup guide

This puts the CRM online with proper logins. You will be Admin. Shweta will be a User.
It takes about 15 minutes, once. Front end on Vercel (from GitHub), backend on Supabase.

## What is in this folder

- `app/` is the website itself. Vercel serves only this folder.
- `supabase/01_schema.sql` creates the database, the logins table and the access rules.
- `supabase/02_seed_oct_week.sql` loads Shweta's 38 calls from the Google Sheet (week of 26 to 30 Oct).
- `supabase/functions/manage-users/index.ts` lets you create and manage logins from inside the app.

## Step 1. Create the database

1. Go to supabase.com and sign up (use the AAS email you want to own this).
2. Click **New project**. Name it `aas-crm`. Region: **Mumbai (South Asia)**.
3. Set a database password and save it somewhere safe. You will rarely need it.
4. Wait about 2 minutes for the project to get ready.

## Step 2. Create the tables

1. In the left menu, open **SQL Editor**, then **New query**.
2. Open `supabase/01_schema.sql` from this folder in TextEdit. Copy everything, paste it in, click **Run**. It should say "Success".
3. New query again. Do the same with `supabase/02_seed_oct_week.sql`. This loads last week's calls.

## Step 3. Stop strangers from signing up

1. Left menu: **Authentication**, then **Sign In / Providers** (on some screens it is under **Settings**).
2. Turn **off** "Allow new users to sign up". Save.

Now only you can create logins.

## Step 4. Create your own Admin login

1. **Authentication**, then **Users**, then **Add user**, then **Create new user**.
2. Enter your email and a password. Tick **Auto Confirm User**. Click Create.
3. The first login created is made Admin automatically.
4. To set your display name, go to **SQL Editor**, run this one line (change the name if you like):

```
update public.profiles set full_name = 'Vivek Sharma' where role = 'admin';
```

## Step 5. Add the "manage-users" function

This is what lets you add Shweta and reset passwords from inside the app.

1. Left menu: **Edge Functions**, then **Deploy a new function**, then **Via Editor**.
2. Name it exactly `manage-users`.
3. Delete the sample code. Paste everything from `supabase/functions/manage-users/index.ts`.
4. Click **Deploy**. Leave "Verify JWT" switched on.

## Step 6. Connect the website to the database

1. Left menu: **Project Settings**, then **API** (or **API Keys**).
2. Copy the **Project URL** and the **anon public** key (newer screens call it the **publishable** key).
   Do not use the "service_role" or "secret" key.
3. Open `app/config.js` in TextEdit. Paste the two values between the quotes. Save.

It should look like this:

```
supabaseUrl: "https://abcdefghijk.supabase.co",
supabaseAnonKey: "eyJhbGciOi....",
```

## Step 7. Put it online (Vercel)

1. Push this folder to the GitHub repo (keep the repo private).
2. In Vercel: **Add New**, then **Project**, then import the repo.
3. Framework Preset: **Other**. Root Directory: **app**. Leave build and output settings empty.
4. Click **Deploy**. You get a link like `aas-crm.vercel.app`. Add a custom domain later if you want, e.g. `crm.adityaarthsetu.com`.
5. Open the link and sign in with your Admin email.

## Step 8. Add Shweta

1. In the app, open **Team logins**, then **Add login**.
2. Name: `Shweta`. Her email. Click **Generate** for a password. Role: **User**.
3. Click **Create login**, then **Copy login details** and send them to her on WhatsApp.
4. The 38 calls from the Google Sheet are linked to her login automatically, because the name matches.

She can change her password after signing in. If she forgets it, open **Team logins**, then **Manage**, and set a new one.

## Who can do what

| | Admin (you) | User (Shweta) |
|---|---|---|
| Log calls, add and edit companies, move pipeline stages | Yes | Yes |
| Edit a call | Any call | Only her own |
| See reports, follow-ups, all companies | Yes | Yes |
| Delete calls or companies | Yes | No |
| Add logins, reset passwords, switch a login off | Yes | No |
| Change daily target, working days, holidays | Yes | No |
| Import from Google Sheets, export to CSV | Yes | No |

These rules are enforced by the database itself, not just hidden in the screen.

## Changing the app later

Push the change to GitHub. Vercel redeploys on its own in about a minute.

## Good to know

- On the free plan, Supabase pauses a project after a week with no use at all. Daily use keeps it awake. If it ever pauses, open the Supabase dashboard and click **Restore**.
- Export a backup now and then: **Settings & data**, then **All calls (CSV)** and **All companies (CSV)**.
- Don't re-import the 26 to 30 Oct week from the Google Sheet. It is already loaded by step 2, and a few company names in the sheet are spelt differently, so they would come in twice.
