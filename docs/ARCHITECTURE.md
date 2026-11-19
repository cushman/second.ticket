# Architecture

## Two products, one platform

1. **Branson Explorer marketplace**: the town's ticket center. Sells every show and attraction, whether or not the venue uses our software.
2. **Venue platform (SaaS)**: box office, branded checkout on the venue's own site, door scanning, live dashboard, reports. Venues pay for it.

Both run on the same catalog, inventory, orders and tickets. A venue on the platform appears on the marketplace automatically with live inventory.

## Supply types (per product)

| `supply_type` | Inventory | Customer receives |
|---|---|---|
| `native` | Live seats/capacity in our database | Mobile ticket, scanned at the door |
| `allocation` | A capacity pool the venue gave us per date | Voucher, redeemed at the venue |
| `api` | The venue's own ticketing system, via integration | Their ticket or our voucher |
| `on_request` | Confirmed by staff with the venue | Voucher after confirmation |

## Money models (per product)

- `commission`: the venue is merchant of record (Stripe Connect). Platform keeps commission + service fee.
- `net_rate`: the platform is merchant of record, sells at retail and owes the venue the agreed net.

See `src/core/pricing.ts`. Every order line stores its venue payout and platform revenue.

## Product kinds

`reserved` (seat maps), `general_admission`, `timed_entry` (go-karts, laser tag), `open_date` (putt-putt, museums). Products can require waivers, set minimum age/height, and allow single or multi-use scans.

## Inventory and locking

`src/core/inventory.ts` is the only code that changes inventory. Every channel (marketplace, venue site, box office, phone, group, comp) uses it.

- Reserved seats are held with a single conditional `UPDATE`; Postgres re-checks the condition after competing commits, so a seat can't be sold twice.
- Capacity pools lock the pool row (`SELECT … FOR UPDATE`) and count active holds.
- Holds expire (default 10 minutes). Staff group holds have no expiry.
- Customers see sold and held seats as "Unavailable"; staff screens show holds.

Tests in `src/core/inventory.test.ts` run against in-process Postgres (PGlite) and, when `TEST_DATABASE_URL` is set, against real Postgres with parallel connections.

## Schedules

`src/core/schedule.ts` expands a rule (date range, weekdays, start times or open/close with a slot interval, dark days) into exact start times in the venue's time zone, correct across daylight-saving changes. `src/core/performances.ts` creates the performances with their inventory: every seat for reserved shows, a capacity pool for general admission, time slots and allocation blocks. Existing start times are skipped, so re-running a schedule is safe (unique on product + start time). A date with tickets sold or held can be taken off sale but not cancelled; holds are refused for any date that isn't on sale.

## Buying online (so far)

Public pages read through `src/server/catalog.ts`: only on-sale, future dates are offered, and expired holds count as available. The seat picker and ticket counters call server actions (`src/app/shows/actions.ts`) that hold inventory for 10 minutes with the ticket type for each seat or quantity (`hold_items`), tagged with a random per-browser token (`be_cart` cookie). Only that browser can open its checkout page (`/checkout/[holdId]`) or release the hold. Checkout prices every line with `priceLine`, so the total shown includes service fees and tax. Payment (Stripe Connect) attaches there next.

## Roles

`platform_admin`, `call_center` (all venues), `venue_manager`, `box_office`, `door`. Stored in `memberships`; `org_id` null means platform-wide, `venue_id` set limits a membership to one venue. Rules live in `src/core/permissions.ts`; every server action checks them against the exact company and venue it changes. Supply type, money model, commission and service fee are platform-only terms.

Sessions are HMAC-signed cookies (`src/core/session.ts`). Development sign-in is a stand-in for the real login provider and is disabled in production.

## Theming

Copper is the default accent. Venues and users can pick their own; `src/core/theme.ts` derives dark and light variants that keep WCAG AA contrast, and `themeCss()` emits the overrides for `design/tokens.css`. Venue checkout pages use the venue's accent and logo.

## Records kept from day one

Sales channel, staff member, payment method, price breakdown (fee, tax, payout, platform revenue), hold owner and expiry, every ticket state change (`ticket_events`), and every scan including rejected ones (`scans`).

## Roadmap

1. **Foundation** (in progress): schema, inventory engine, pricing, theming, site shell, roles and permissions, staff admin (venues, seat maps, shows and attractions, schedules, brand colors). Next: production sign-in (Supabase Auth) to replace development sign-in.
2. **Marketplace** (in progress): catalog, show pages, date/time pickers, seat picker with best-available, ticket counters and held checkout are built. Next: payment with Stripe Connect, mobile tickets and vouchers, voucher redemption page, call-center selling.
3. **Venue platform basics**: offline-capable scanning app, live dashboard, venue-branded checkout.
4. **Full box office**: window and phone screens, close-outs, settlements, migrations from old systems.
5. **Integrations** with other ticketing systems as venues need them.
