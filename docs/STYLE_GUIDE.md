# Branson Explorer Style Guide

Direction: **Copper**. Warm charcoal with one copper accent, bold condensed headlines, crisp corners. Dark mode is the default; every screen also ships in light mode.

Design canvas (mockups): https://claude.ai/artifact/7WwZoezsFyTfTD9mZXzceV
Tokens in code: [`design/tokens.css`](../design/tokens.css)

## Audience

Branson visitors skew older (average adult in their late 50s) and family-heavy (35–40%). Design for them first:

- Body text 17px, lead text 19px, nothing below 13px.
- Body text contrast of at least 7:1; never rely on color alone.
- Short checkout, large tap targets (44px minimum).
- Show tax and fees before checkout. Competitors advertise "no fees", so being upfront matters.

## Color

| Token | Dark | Light | Use |
|---|---|---|---|
| `--be-bg` | `#151312` | `#F5F3F1` | Page background |
| `--be-panel` | `#201C1A` | `#FFFFFF` | Cards, search bar, seat map |
| `--be-photo` | `#2C2724` | `#EAE5E1` | Image placeholders |
| `--be-line` | `#3B3531` | `#DCD4CE` | Borders, dividers |
| `--be-fg` | `#F5F0EB` | `#1C1816` | Main text |
| `--be-muted` | `#B8AFA8` | `#4F4641` | Secondary text |
| `--be-accent` | `#E8834A` | `#B4531E` | Buttons, your seats, logo |
| `--be-on-accent` | `#151312` | `#FFFFFF` | Text on accent |
| `--be-accent-text` | `#F09A66` | `#A04717` | Accent-colored text (prices, highlights) |

Rules:

- One accent only. Copper marks the action and the user's own choices.
- Errors are not copper. Show them with an icon and plain words ("That seat was just sold. Pick another.").
- Measured contrast: main text ~16:1; muted text 7.8–9.2:1; accent buttons 5.0–6.9:1.

## Type

| Role | Face | Notes |
|---|---|---|
| Display | Big Shoulders Display 800–900, uppercase | Headlines and show names only, 22px and up. Never for labels or body. |
| Body | DM Sans 400/500/700 | All reading text, labels, buttons. |
| Data | DM Mono 400/500 | Showtimes, rows and seats, order codes. |

## Shape

- **Crisp corners**: 6px on buttons and inputs, 10px on cards and panels.
- Show cards are ticket stubs: the price sits behind a dashed perforation on the right.
- 1px borders in `--be-line`. No drop shadows on cards.

## Seat maps

Customers see three states. Staff screens add holds.

| State | Look | Who sees it |
|---|---|---|
| Available | Outlined seat, 2px `--be-seat-ring` | Everyone |
| Your seats | Solid `--be-accent` with a check mark | Everyone |
| Unavailable | Faint `--be-seat-unavailable` fill with an × | Everyone (sold and held both show this way to customers) |
| Group hold | Diagonal stripes in `--be-seat-hold-stripe` | Box office and venue staff only |

Every state differs in shape as well as color so the map works for color-blind users.

## Content conventions

- Prices: Adult, Teen (13–18), Child (4–12), Under 4 free where the venue allows.
- Times: `2:00 · 7:30 PM`.
- Categories: Music & variety, Dinner shows, Comedy & magic, Faith & family, Theme parks, On the lake, Museums, Outdoor adventure, plus a Christmas season (Nov 1 – early Jan).
- Write plainly. Buttons say what they do: "Find tickets", "Continue", "Release hold".
