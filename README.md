# Aviv Mellick Aesthetics: online health and consent form

Static site on GitHub Pages. Submissions go to a private Supabase database.

- `index.html`: the form for clients. Wording lives in `form-data.js`.
- `admin.html`: the clinic's login and record view.
- `supabase/schema.sql`: tables and access rules. The public can only insert; only users listed in `admins` can read; nobody can edit or delete a signed form through the API.
- `config.js`: Supabase URL and publishable key. Never put the secret / service_role key here.

## Changing the wording

Edit `form-data.js` and bump `VERSION`. Each record stores the version it was signed on, and git history keeps the exact text of each version.

## Adding a clinic user

1. Supabase > Authentication > Users > Add user.
2. In the SQL editor: `insert into public.admins (user_id) values ('<the user id>');`
