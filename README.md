# DeLune — Fashion catalogue starter

A responsive luxury-minimalist storefront for a Bangladesh fashion label. Currency is BDT (৳); product enquiries are sent to WhatsApp.

## Included
- `index.html`: home, exclusive products and category showcase
- `categories.html`: browsable product catalogue and category filters
- `product.html`: product detail and WhatsApp order link
- `about.html`, `contact.html`
- `moderate.html`: restricted moderator dashboard
- `config.js`: Supabase and WhatsApp configuration
- `supabase-schema.sql`: database, RLS and storage policies
- `styles.css`, `app.js`, `store.js`, `moderate.js`

## Preview
Open `index.html` in a browser. Without Supabase credentials, the storefront uses sample/demo products. Moderator publishing is disabled until Supabase is configured.

## Go live checklist
1. Create a Supabase project.
2. Open SQL Editor and run `supabase-schema.sql`.
3. In Storage, create a **public** bucket named `product-images`.
4. Create a moderator account in Authentication > Users (email + strong password).
5. Copy that user's UUID and add it to `public.moderators`:
   ```sql
   insert into public.moderators(user_id) values ('YOUR_AUTH_USER_UUID');
   ```
6. In `config.js`, set `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `WHATSAPP_NUMBER`.
   - WhatsApp format: country code + phone number, digits only, e.g. `8801XXXXXXXXX`.
   - Use only the Supabase **anon/public** key in the frontend. Never expose `service_role`.
7. Host the folder on Netlify, Vercel, or another static host with HTTPS.
8. Test as a visitor and as a moderator before announcing the site.

## Moderator workflow
Visit `/moderate.html`, sign in with the moderator email and password, then add/edit products and categories. Products can have multiple uploaded images, descriptions, BDT prices, sizes, availability and an exclusive flag.

## Current starter limitations / next iteration
- Orders are initiated through WhatsApp; there is no payment gateway, cart, shipping calculator or order database.
- The homepage banner URL editor currently shows a placeholder confirmation; the hero image is currently styled in `styles.css`. A `site_settings` table and live banner binding should be added for full banner management.
- Category cover image URLs can be set when creating categories. Category deletion should be used only after products are reassigned.
- The About and Contact copy is starter content; update it with DeLune's real brand story and contact details.
- Product photo replacement uploads new files; old storage objects are not automatically cleaned up.
- Add rate limiting / CAPTCHA and operational backups before a high-traffic launch.
