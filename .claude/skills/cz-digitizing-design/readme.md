# CZ Digitizing — Design System

CZ Digitizing is a machine-embroidery digitizing studio. Customers send artwork; CZ
returns machine-ready stitch files (DST, PES, JEF, EXP) and vector art. The business runs
on a WhatsApp-first, globally distributed customer base — the sample data in the brand
document shows customers in Pakistan, the UAE, the UK, the USA, Canada, Australia,
Germany, Saudi Arabia, France, Italy and China.

Two products are represented, and both are recreated here as UI kits:

1. **Marketing website** (`www.czdigitizing.com`) — Home, Services, Pricing, Get a Quote,
   Cart, Account, Contact Us. Sells two service families: Embroidery Digitizing (logo, cap
   & hat, 3D puff, left chest, jacket back, patch & badge, applique, image-to-embroidery)
   and Vector Art (vectorization, illustration, conversion, SVG/EPS/PDF). Pricing is both
   subscription (Starter $19 / Professional $49 / Business $99 per month) and prepaid
   credits (10 / 25 / 50 / 100).
2. **Admin panel** — an internal operations console: Dashboard, Customers, Orders,
   Payments, Designs, Categories, Services, Quotes, Downloads, Reports, Data Export,
   Activity Log, Settings. Tagline on the panel header: **MANAGE · TRACK · GROW**.

Contact details published in the brand kit: WhatsApp +92 317 4604508,
czdigitizing@gmail.com, PKR currency, UTC+05:00 Karachi timezone. The site offers
16 languages (English, Urdu, Arabic, Spanish, French, German, Italian, Portuguese,
Turkish, Chinese, Japanese, Korean, Russian, Hindi, Bengali).

## Sources

Everything here was derived from a single supplied file:

- `uploads/CZ Digitizing desighn.docx` — four full-page images:
  1. the logo lockup on black,
  2. the **Brand Kit** sheet (colour palette with hex values, typography, website/UI icons, logo versions, favicon and app icon, shirt-embroidery photography, brand elements, desktop and mobile site mockups),
  3. the **User Interface** sheet (10 website screens + admin panel + notifications at mockup scale),
  4. the **Admin Panel Dashboard** sheet (11 admin panels + the brand colour and brand element strips).

The extracted page images are kept in `scraps/image1–4.png` for reference. **No codebase,
Figma file or font binaries were provided.** All numeric values (paddings, radii, type
sizes) are therefore read off the mockups and stated as intentional decisions here rather
than copied from source code — if you have the real front-end, correct these tokens
against it.

---

## CONTENT FUNDAMENTALS

**Voice.** Confident craftsman. The brand talks about precision, quality and turnaround —
never about technology or AI. Sentences are short, declarative and free of hedging.

**Person.** Marketing copy speaks to the customer as **you** and about the studio as
**we**: "Turn Your Designs Into Beautiful Embroidery", "We'd love to hear from you. Get in
touch with us anytime." The admin panel drops person entirely and uses bare noun labels:
"Customers", "Total Revenue", "Pending Payments".

**Casing.** Marketing headings are Title Case ("Premium Embroidery Digitizing & Vector Art
Services", "What Our Customers Say", "Ready to Turn Your Artwork Into Perfect Stitches?").
Micro-labels and taglines are ALL CAPS with wide tracking ("MACHINE EMBROIDERY DESIGN",
"MANAGE · TRACK · GROW", "INSPIRE · DIGITIZE · STITCH"). Table column heads are uppercase.
Body copy is sentence case.

**Verbatim brand lines — do not rewrite these:**
- Stitching Your Ideas Into Perfection
- Your Vision, Our Stitches
- Your Business, Our Priority
- Together We Create
- MACHINE EMBROIDERY DESIGN
- MANAGE · TRACK · GROW
- INSPIRE · DIGITIZE · STITCH
- Your Ideas, Digitized with Precision

**Proof points** are stated as bare facts, always paired two-line: "10 Years / of
Experience", "High Quality / Digitizing", "Fast Delivery / On Time", "100% Customer
Satisfaction", "Multiple File Formats", "Global Clients". Never padded into sentences.

**Numbers** carry units and periods: "+12% this month", "$48,750", "892", "Showing 1 to 8
of 892 orders", "($1.40 per credit)". Deltas always name the period.

**CTAs** are two or three words, imperative: "Get a Quote", "Explore Services", "Choose
Plan", "View Service", "Send Message", "Submit Quote Request", "Export", "View All
Questions". Never "Learn more" or "Click here".

**Punctuation.** The middle dot (·) separates tagline words. The ampersand is used freely
in headings ("Payment Details & Receipt", "Reports & Analytics"). No exclamation marks.
No em-dash rhetoric.

**Emoji.** Not used, with exactly one exception: country flags in the "Trusted by
Businesses Worldwide" row and the language picker. Everything else is a line icon.

**Vibe.** Premium but plain-spoken — jeweller's window, not tech startup. Gold and navy do
the luxury work so the copy can stay factual.

---

## VISUAL FOUNDATIONS

**Colour.** Five brand colours, stated with hex values in the kit: Deep Navy `#0B132B`,
Slate Blue `#4A5568`, Light Gray `#E5E7EB`, Gold Accent `#D4AF37`, White `#FAFAFA`. Navy
and gold are the identity; slate and grey are the working neutrals. **Gold is the only
saturated colour and it is scarce** — one primary CTA per view, active nav pills, active
segments, hairline rules, the eyebrow labels, and nothing else. Status colours (green,
amber, red, blue, violet) exist only inside data pills and KPI icon chips, at low
saturation on tinted backgrounds. Never more than two background colours in one layout:
navy sections and light-grey/white sections.

**Type.** Playfair Display for every heading, price and KPI figure; Montserrat for all UI
text, labels and paragraphs. Playfair is set bold with slightly negative tracking
(`-0.01em`) and tight leading (1.06–1.3) — it should feel engraved. Montserrat sits at 400
for prose and 600 for anything functional. Italic Playfair is reserved for the script-like
brand taglines ("Stitching Your Ideas Into Perfection"). Tracking is the brand's main
typographic gesture: uppercase micro-labels run from `0.06em` to `0.26em`.

**Spacing.** 4px base step. Cards pad 20px (14px when dense), grids gap 12–24px, marketing
sections breathe at 80px vertical. Fields are 40px tall (32px dense), table rows 44px.
Admin sidebar is 216px, screen header 64px. Content column caps at 1240px.

**Backgrounds.** Three treatments and no others:
1. **Navy flat** — sidebars, footers, band sections, headers.
2. **Navy fabric** — a dark woven-cloth texture behind the logo on hero and cover art
   (`assets/brand-hero-fabric.png`). Subtle; the weave reads as texture, not pattern.
3. **Photographic hero** — a close-up embroidery-machine or stitched-garment photo, full
   bleed, dimmed under a left-to-right navy protection gradient
   (`rgba(11,19,43,.95)` → `.35`) so white type stays legible.
No gradients as decoration, no bluish-purple, no illustration, no mesh, no noise overlay,
no repeating pattern.

**Imagery.** Real photographs of stitched results on garments: black and navy polos, a
white polo, a jacket back, gold cording on black cloth. Tight crops, cool low-key
lighting, visible thread and fabric texture, shallow depth of field. No people, no flat
illustration, no 3D renders, no lifestyle stock. Assets are in `assets/photo-*.png`.

**Corner radii.** Cards 10px, buttons and fields 8px, small chips 6px, badges and nav
pills fully round, app icon ~22%. Nothing is fully square except table cells and full-bleed
bands.

**Cards.** White ground, 1px `#E5E7EB` border, 10px radius, `--shadow-sm` (a barely-there
navy-tinted 1–3px shadow). Optional Playfair title with a control on the right. Navy cards
use `--shadow-navy` and a 10%-white hairline. **No coloured left borders, ever.** The only
tinted card is the gold-soft upsell strip.

**Shadows.** All shadows are navy-tinted (`rgba(11,19,43,…)`) and low-contrast: xs 1–2px,
sm for resting cards, md on hover, lg for the featured pricing plan. `--shadow-gold` (a
6/18px gold bloom) appears only under a hovered primary CTA. Inner shadows are used only
as hairline insets, never for depth.

**Borders and rules.** Hairlines everywhere: `--border-subtle` (#E5E7EB) on light,
`rgba(250,250,250,.10)` on navy. The gold rule is a 1px decorative line used under
eyebrows, either side of the logo tagline, and to close dark sections — often faded out at
both ends.

**Hover states.** Buttons lighten (gold 500 → 400) and pick up the gold bloom; secondary
navy goes one step lighter; ghost controls fill with `--gray-200`. Cards lift 2px
(`translateY(-2px)`), gain `--shadow-md` and switch their border to gold. Links move from
`--gold-600` to `--gold-700` and gain a 3px-offset underline. No colour inversions,
no scale-ups.

**Press states.** A 1px downward nudge (`translateY(1px)`) plus the darker gold (600). No
shrink, no ripple.

**Focus.** `--ring-focus`: a 3px `rgba(212,175,55,.35)` ring, with the field border going
solid gold. Never a browser-default blue outline.

**Animation.** Short, flat, unfussy. 80ms for press feedback, 140ms for hover colour
changes, 220ms for card lifts and accordion chevrons, 360ms for panel entrances.
`cubic-bezier(.2,.6,.3,1)` is the default; `cubic-bezier(.16,.84,.44,1)` for entrances.
**No bounce, no spring, no elastic, no parallax, no scroll-triggered reveals.** Colour and
border transitions carry almost all of the motion budget.

**Transparency and blur.** Transparency is used in exactly two places: the navy protection
gradient over hero photography, and translucent white fills (`rgba(250,250,250,.06–.12`)
for controls sitting on navy. **Blur is not part of this brand** — no frosted glass, no
backdrop-filter.

**Protection.** Text over photography always sits on a directional navy gradient, never on
a capsule or pill. Capsules are reserved for status and count badges.

**Layout rules.** Marketing pages are a single 1240px column with full-bleed navy bands
between sections. The admin panel is a fixed navy sidebar plus a scrolling main region;
the screen header is sticky-feeling (white, hairline bottom). Tables never zebra-stripe —
hairline row rules only — and always carry a range summary paired with the pager. KPI rows
are always four across.

---

## ICONOGRAPHY

The brand kit shows a small set of **gold outline line icons**, roughly 1.5–2px stroke,
rounded joins, no fill: Home, Services (a 2×2 grid), Designs (a shirt), About (a gear),
Contact (an envelope), Search, plus WhatsApp/Email/Facebook/Instagram/LinkedIn/YouTube
social glyphs and the admin set (dashboard, users, orders, payments, downloads, reports,
settings). The five **brand elements** are drawn in the same outline language: Moon
(vision), Needle (precision), Thread (creativity), CZ (identity), Star (excellence).

**Substitution — please confirm.** The kit supplies these icons only as raster pixels
inside a page image, so there is no SVG or icon font to copy. This system therefore uses
**Lucide** (`lucide-static@0.544.0`) from CDN — the closest match for stroke weight, round
joins and the unfilled outline style — rendered through the `Icon` component as a CSS mask
so every glyph inherits `currentColor` and can be tinted gold. If you have the original
SVG set, drop it into `assets/icons/` and I will rewire `Icon` to it.

The original raster icon strips are preserved for reference at
`assets/reference-website-icons.png` and `assets/reference-brand-elements.png`.

Rules of use: icons are gold on navy and gold-on-soft-gold inside `IconTile`; they are
`--text-muted` when purely functional (a select chevron, a search magnifier). Icons never
appear at more than 24px in UI, and never in a filled circle of a status colour. Unicode
characters are used for the middle dot (·) and quotation marks only. Emoji appear only as
country flags.

**Logo.** The mark is a brushed-silver crescent moon cradling a serif **CZ**, threaded by a
gold needle and thread, over the wordmark CZ DIGITIZING and the gold tagline rule MACHINE
EMBROIDERY DESIGN. All five supplied versions are in `assets/` — never redraw, retypeset or
recolour it.

---

## Index

**Root**
- `readme.md` — this file
- `SKILL.md` — Agent Skills front-matter wrapper
- `styles.css` — the single stylesheet consumers link; `@import` list only
- `thumbnail.html` — homepage tile

**`tokens/`** — `fonts.css`, `colors.css`, `typography.css`, `spacing.css`, `radius.css`,
`elevation.css`, `motion.css`, `base.css`

**`assets/`** — `logo-light.png`, `logo-dark.png`, `logo-mono.png`, `logo-primary-dark.png`,
`mark-dark.png`, `app-icon.png`, `brand-hero-fabric.png`, `photo-polo-black.png`,
`photo-polo-navy.png`, `photo-polo-white.png`, `photo-fabric-cz.png`,
`photo-jacket-back.png`, `photo-gold-stitch.png`, `photo-embroidery-machine.png`,
`reference-website-icons.png`, `reference-brand-elements.png`

**`guidelines/`** — 23 specimen cards feeding the Design System tab: Colors (brand core,
navy ramp, gold ramp, neutrals, status pills, semantic aliases), Type (display, body,
weights, eyebrows, pairing), Spacing (scale, layout tokens, in use, radii, elevation,
motion), Brand (logos, elements, taglines, imagery, fabric ground, iconography).

**`components/`** — 37 primitives in six groups:

- **brand/** — `Logo`, `Eyebrow`, `GoldRule`, `Icon`, `IconTile`
- **core/** — `Button`, `IconButton`, `Badge`, `Card`, `Avatar`, `Tabs`,
  `SegmentedToggle`, `Accordion`, `Pagination`
- **forms/** — `FormField`, `Input`, `SearchField`, `Select`, `Textarea`, `FileField`,
  `Checkbox`, `Radio`
- **data/** — `StatCard`, `DataTable`, `ActivityRow`, `DonutStat`, `BarChart`, `LineChart`
- **marketing/** — `FeatureItem`, `ServiceCard`, `PricingCard`, `CreditPack`,
  `TestimonialCard`, `FlagChip`
- **navigation/** — `SiteHeader`, `TopBar`, `SidebarNav`

Each has a sibling `.d.ts` props contract and a `.prompt.md` usage note; each directory
carries one `@dsCard` HTML showing its variants.

**`ui_kits/`**
- `website/` — marketing site: `HomePage`, `ServicesPage`, `PricingPage`, `QuotePage`,
  `CartPage`, `SiteChrome` (+ Contact). See `ui_kits/website/README.md`.
- `admin_panel/` — operations console: `DashboardView`, `CustomersView` (+ customer
  profile), `OrdersView` (+ payment detail), `DesignsView`, `ReportsView`,
  `ActivityView`, `AdminShell`, `AdminData`. See `ui_kits/admin_panel/README.md`.

### Intentional additions

The source is a brand-kit document rather than a component library, so the component
inventory was derived from the interfaces it depicts. Three items go slightly beyond what
the mockups literally show:

- **`Icon`** — a wrapper so the substituted Lucide set can be swapped for the real SVGs in
  one place.
- **`BarChart` / `LineChart` / `DonutStat`** — the dashboard and reports panels contain a
  line chart, a column chart and a category donut; these are the minimum flat renderings
  needed to rebuild those panels without a charting library.
- **`GoldRule`** — the gold hairline appears in the logo lockup, section closes and
  taglines; making it a component keeps its treatment consistent.

### Known gaps

- No font binaries were supplied. Playfair Display and Montserrat are loaded from Google
  Fonts, which is what the kit names — but if the studio licensed specific weights, send
  the files and `tokens/fonts.css` becomes `@font-face` rules.
- No icon SVGs were supplied (see ICONOGRAPHY substitution note).
- The website Account page and mobile view, and the admin Payments, Categories, Services,
  Quotes, Downloads and Settings screens, are legible only as thumbnails in the source and
  are not reproduced.
