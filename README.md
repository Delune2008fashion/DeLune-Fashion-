# DeLune — Fashion catalogue starter

A responsive luxury-minimalist storefront for a Bangladesh fashion label. Currency is BDT (BDT ); product enquiries are sent to WhatsApp.

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

## Quality and security improvements

- Storefront transitions respect the user's `prefers-reduced-motion` setting.
- Product/category lists show animated loading states and retry controls after data errors.
- SEO descriptions, canonical URLs, Open Graph and Twitter preview metadata are included on public pages. Product detail metadata is updated from the selected product.
- Responsive browser smoke tests cover 320, 360, 390 and 430 px viewports. GitHub Actions runs them on pushes and pull requests.
- Moderator Studio checks membership in `public.moderators` after sign-in and when restoring a session. Client-side image checks limit uploads to 8 files, 5 MiB each; Supabase Storage enforces image MIME types and the 5 MiB limit too.
- `security-smoke-tests.sql` contains manual RLS checks. Apply the updated `supabase-schema.sql` in the Supabase SQL Editor before relying on the hardened policies.

### Run browser tests locally

```sh
npm install
npx playwright install chromium
npm run test:mobile
``

### Supabase security notes

The browser uses only the Supabase publishable/anon key. Never put a `service_role` key in `config.js`. Public visitors can read available products, visible categories and the two public site settings; only UUIDs listed in `public.moderators` can manage catalog content. Run `security-smoke-tests.sql` after applying the schema and verify a non-moderator account cannot write.


## Commerce and Merchant Portal (2026-11-12)

This update adds a separate delivery-charge checkout, a protected Merchant Portal, and a Site Creator console while preserving the existing product catalogue, moderator tools, WhatsApp and Messenger enquiry flow.

### New pages
- `checkout.html`: customer details, product variant/quantity, bKash or configured Nagad, Transaction ID submission.
- `merchant.html`: merchant-only order queue, manual payment confirmation/rejection, customer WhatsApp notification now/later, optional tracking.
- `creator.html`: Site Creator-only manual Merchant account creation, invitation links, delivery charge and recipient-number settings, unassigned-order assignment.
- `accept-invitation.html`: one-time Merchant invitation activation.

### Supabase setup required before checkout works
1. Run the existing `supabase-schema.sql` if it has not already been applied.
2. Run `delune-commerce-migration.sql` in Supabase SQL Editor.
3. Create the Site Creator owner account in Supabase Authentication. Copy its Auth UUID, then run the bootstrap SQL at the bottom of `delune-commerce-migration.sql` to grant `site_creator`.
4. Deploy the Edge Function from this repository: `supabase functions deploy delune-api`. Set/confirm the Edge Function environment variables `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in the Supabase project. Never place the service-role key in browser code.
5. In `creator.html`, sign in as Site Creator and set the delivery charge. The bKash recipient is prefilled as `+8801875312169`; it can be changed later in the same dashboard. Nagad remains disabled until its recipient number is added.
6. Create a Merchant manually or generate an invitation from `creator.html`. Merchants sign in at `merchant.html`.
7. If exactly one Merchant is active, new orders are assigned automatically. If multiple Merchants are active, new orders stay unassigned until the Site Creator assigns them in the Creator console.

### Transaction and payment rules
- Payment verification is manual. A Merchant must compare the submitted ID with the actual received payment in the relevant bKash/Nagad account before confirming.
- `(provider, normalized_transaction_id)` is globally unique. The same ID cannot be reused for another order with that provider, including after a rejected or cancelled order.
- A unique Transaction ID is not proof that money was received.
- “Notify customer now” opens WhatsApp with a prepared message. “Send message later” saves the message in the Merchant queue; the Merchant opens WhatsApp and presses Send. Fully automated WhatsApp sending requires a later WhatsApp Business Platform integration.
- Checkout is paused until the Site Creator sets a delivery charge. Only the delivery charge is collected; the product price is retained for order reference.

The GitHub Pages files are committed to `main`. Supabase SQL migration and Edge Function deployment are separate steps and must be completed before accepting real orders.
