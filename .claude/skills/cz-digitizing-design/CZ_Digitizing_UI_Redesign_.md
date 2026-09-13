# CZ Digitizing — Deep UI Redesign / Visual Correction Prompt for Claude Code

## IMPORTANT: READ THIS BEFORE EDITING

The existing CZ Digitizing application is already coded and functional.

This is NOT a rebuild, refactor, feature-development, backend-development, database-development, or architecture task.

This is a **visual redesign and visual correction task only**.

The supplied CZ Digitizing brand references are the design source of truth. The current screenshots are the implementation that is visually wrong and must be corrected.

---

## 1. SOURCE-OF-TRUTH ORDER

Use this order when making decisions:

1. Supplied CZ Digitizing logo / brand-kit references
2. Supplied customer-site reference
3. Supplied admin-panel reference
4. `DESIGN_SYSTEM.md`
5. Existing application's functionality and existing content
6. Current implementation screenshots only to identify what is wrong

Do NOT copy the current implementation's visual style just because it already exists.

Do NOT invent a new visual style.

---

## 2. CURRENT IMPLEMENTATION PROBLEMS I WANT FIXED

I inspected the current customer and admin screenshots.

### CUSTOMER WEBSITE — CURRENT PROBLEMS

The current customer homepage does NOT sufficiently match the CZ Digitizing reference design.

Observed problems:

- The header is visually generic and cramped.
- Navigation items wrap into multiple lines unnecessarily.
- The header has too many visible items competing for space.
- The logo is visually too small/weak compared with the reference.
- The overall header does not have the premium polished CZ Digitizing appearance.
- The hero is mostly a generic blue gradient/solid panel.
- The reference design has a much stronger premium dark navy/black embroidery aesthetic.
- The reference uses strong embroidery-related imagery/visual storytelling.
- The current hero lacks the premium embroidery-machine/design visual impact shown in the reference.
- The hero typography hierarchy is not sufficiently close to the reference.
- The gold accent is present but the overall composition does not feel like the brand kit.
- The page has excessive empty/unfinished visual space below the hero.
- The visual hierarchy between hero, featured designs, services and other sections is weak.
- The current UI looks like a generic template with CZ branding placed on it rather than a deliberately designed CZ Digitizing website.
- The current Taebo message bubble contains an obviously incorrect test-like message about Antarctica. This must NEVER appear in the production UI.
- Taebo is not visually represented as the requested full-body realistic panda character.
- The chatbot should look like an intentional branded assistant, not a generic floating test widget.

### ADMIN PANEL — CURRENT PROBLEMS

The current admin screenshot is also NOT acceptable compared with the supplied admin reference.

Observed problems:

- It opens into a plain "Admin Portal" page instead of presenting the designed CZ Digitizing admin experience.
- The login screen is missing/not visually implemented according to the CZ design.
- The main content is largely blank/unstyled.
- The sidebar is too plain and does not resemble the premium admin reference.
- The logo is too small and weak.
- Navigation typography and spacing are not sufficiently branded.
- Active navigation styling is missing or weak.
- The admin UI does not have the premium dashboard/card/table visual system shown in the reference.
- The page looks like a technical/admin prototype instead of a finished business dashboard.
- The design lacks the CZ navy/gold visual identity.
- There is insufficient visual hierarchy.
- The current page must NOT be "fixed" by adding random content or changing functionality. It must be visually redesigned around the existing admin functionality.

---

# 3. ABSOLUTE FUNCTIONALITY FREEZE

DO NOT CHANGE:

- Backend
- API endpoints
- API contracts
- Database schema
- Database records
- Authentication logic
- Authorization logic
- Sessions
- Cookies
- Password handling
- 2FA/security logic
- Routes
- URL structure
- Business logic
- Cart logic
- Checkout logic
- Payment logic
- Download permissions
- File-upload processing
- File storage
- Customer data
- Order data
- Quote data
- Notification behavior
- Admin permissions
- Existing integrations
- Existing chatbot logic
- Existing chatbot message routing
- Existing search logic
- Existing filtering logic
- Existing form submission behavior

DO NOT:

- Add features
- Remove features
- Replace real data with mock data
- Rewrite working functions
- Rebuild the app
- Migrate frameworks
- Replace the existing architecture
- Refactor unrelated code

If you discover a functional problem while doing the visual work, DO NOT fix it as part of this task unless the fix is strictly required to render the existing UI. Report it separately.

---

# 4. LOGIN PAGE — IMPORTANT CORRECTION

The supplied design reference includes a proper polished account/login visual language.

The current implementation does not present the login experience according to the brand.

You MUST inspect the existing login/authentication route/component and redesign its appearance.

The login page must visually belong to CZ Digitizing.

Suggested visual direction:

- Deep Navy background
- CZ Digitizing logo prominently but proportionally
- Elegant centered authentication card
- Playfair Display heading
- Montserrat labels/body
- Gold primary login button
- Light/white input surface
- Gold focus state
- Subtle premium border/shadow
- Optional embroidery-themed background/image treatment if supported by existing assets
- Clean spacing
- Professional error/success states

Use the EXISTING authentication fields and actions.

Do not change authentication behavior.

Do not add/remove authentication methods.

Do not create a new auth system.

The same visual treatment must be applied consistently to:
- Login
- Create Account
- Forgot Password
- Reset Password
- 2FA screens
- Other existing authentication screens

Only where those screens already exist.

---

# 5. CUSTOMER SITE — REQUIRED VISUAL DIRECTION

The customer website should visually match the supplied CZ Digitizing brand kit and customer-site reference.

## Brand

CZ DIGITIZING
MACHINE EMBROIDERY DESIGN

## Colors

Deep Navy: #0B132B
Slate Blue: #4A5568
Light Gray: #E5E7EB
Gold: #D4AF37
White: #FAFAFA

## Typography

Headings:
Playfair Display

Body/UI:
Montserrat

---

# 6. CUSTOMER HEADER

Redesign the existing header.

Required visual hierarchy:

- CZ Digitizing logo on the left
- Clean navigation
- Active page indicated with gold
- Search/action controls visually integrated
- Account/cart controls visually integrated
- Premium dark navy background
- White primary text
- Gold accent
- No cramped multi-line navigation
- No accidental wrapping where it harms the design

IMPORTANT:

Do not remove existing navigation functionality.

If the existing navigation contains many items, use a visually appropriate responsive structure such as:
- grouped navigation
- More menu
- dropdown
- responsive menu

ONLY if this can be done without changing the existing destinations/functionality.

The reference's clean visual hierarchy is more important than forcing every item into one row.

---

# 7. HERO — MAJOR CORRECTION

The current hero is too generic.

Do NOT keep the current generic blue block as the final design.

The hero should communicate:

PREMIUM MACHINE EMBROIDERY
DIGITIZING & VECTOR ART

Visual direction:

- Deep navy / near-black
- Premium embroidery imagery
- Machine embroidery / stitching visual
- Strong photographic or high-quality visual treatment
- Elegant Playfair Display headline
- Montserrat supporting text
- Gold highlight
- Gold CTA
- Secondary outlined CTA
- Sophisticated image overlay
- High contrast
- Premium composition

The hero must feel like the supplied brand reference, not a generic SaaS landing page.

Do not invent random stock imagery if the project already has suitable assets.

Use existing relevant project assets first.

---

# 8. CUSTOMER SECTIONS

Restyle ALL existing customer-facing pages/components using the same system.

This includes, wherever they already exist:

- Home
- Services
- Design Categories
- All Designs
- Design Bundles
- Design Detail
- Cart
- Checkout
- Login
- Create Account
- My Account
- Orders
- Downloads
- Quotes
- Custom Requests
- Payment Receipt
- Notifications
- Reviews/Testimonials
- FAQ
- Tips
- Contact
- About
- Portfolio
- Blog
- Subscription/Pricing
- Other existing customer pages

Do not add missing pages as part of this task.

If a page exists, redesign it.

---

# 9. DESIGN CARDS

Use the reference visual language:

- Clean premium card
- Consistent image ratio
- Strong product image
- Navy/dark text
- Gold price/action accent
- Light border
- Subtle shadow
- Consistent spacing
- Elegant hover effect

Existing flip-card behavior must remain.

Only redesign:
- front appearance
- back appearance
- typography
- spacing
- borders
- controls
- visual transitions

Do not change the flip functionality.

---

# 10. ADMIN PANEL — MAJOR CORRECTION

The admin panel must look like the supplied CZ Digitizing admin reference.

It should NOT look like the current plain "Admin Portal" prototype.

Use:

- Deep Navy sidebar
- CZ logo at top
- Gold active navigation
- White/light content area
- Premium cards
- Clean tables
- Consistent status badges
- Gold accents
- Playfair Display for major headings
- Montserrat for UI
- Subtle shadows
- Strong spacing system
- Professional dashboard hierarchy

Existing admin sections should receive this visual treatment.

---

# 11. ADMIN LOGIN / ACCESS

If the existing application has a separate admin authentication screen, redesign it to match the CZ Digitizing brand.

Do not bypass or weaken authentication.

Do not remove security.

Do not create a fake login.

Use the existing login flow and only redesign:
- background
- logo
- card
- inputs
- buttons
- typography
- spacing
- error states
- loading state

If `/admin` currently displays an "Admin Portal" landing page before login, inspect the existing authentication flow and preserve its logic while making the visual experience match the intended admin design.

Do NOT disable mandatory authentication.

---

# 12. ADMIN SIDEBAR

Visual hierarchy:

BRAND LOGO

MAIN
- Dashboard
- Orders
- Customers
- Designs
- Bundles

BUSINESS
- Payments
- Services
- Quotes
- Quote Questions
- Custom Requests
- File Format Requests
- Subscription Plans
- Other existing sections

Use the actual existing navigation.

Do not hard-code a new menu.

Visual rules:

- Navy background
- White/muted inactive items
- Gold active item
- Gold/white icons
- Clear section labels
- Consistent vertical rhythm
- Scrollable if required
- Responsive collapse on mobile

---

# 13. ADMIN DASHBOARD

Restyle existing dashboard content into the visual hierarchy shown by the supplied reference.

Use existing real data.

Visual layout:

KPI cards
↓
Sales/Orders overview
↓
Top designs / categories / existing analytics
↓
Recent activity / existing information

Do not invent analytics.

Do not change calculations.

Only change presentation.

---

# 14. ADMIN TABLES

Existing tables should receive:

- Clean white surface
- Light-gray borders
- Navy headings
- Montserrat text
- Gold selected controls
- Semantic status badges
- Consistent action buttons
- Good row spacing
- Responsive treatment

Do not change:
- sorting logic
- filtering logic
- pagination logic
- actions
- data

---

# 15. TAebo — COMPLETE CHARACTER REDESIGN

The current Taebo presentation is not acceptable.

Taebo is the CZ Digitizing website chatbot assistant.

## Character identity

Name:
TAEBO

Character:
REALISTIC FULL-BODY PANDA

This is a hard requirement.

Taebo must be a believable, realistic panda — NOT a cartoon mascot.

### Required appearance

- Full body visible in the master asset
- Realistic panda anatomy
- Natural proportions
- Realistic black-and-white fur
- Detailed realistic fur texture
- Natural ears
- Natural paws
- Realistic eyes
- Friendly intelligent expression
- Professional appearance
- Approachable
- Premium studio-quality rendering
- Natural three-quarter/front pose
- Clean silhouette
- High-resolution asset
- Transparent background for the master asset if possible

### DO NOT CREATE

- Cartoon panda
- Anime panda
- Chibi panda
- Sticker panda
- Toy panda
- Plastic panda
- Giant-head panda
- Human/panda hybrid
- Fantasy animal
- Childish mascot
- Low-resolution cutout

---

# 16. TAEBO BRANDING

Taebo must belong to CZ Digitizing visually.

Use subtle brand cues:

- Deep Navy
- Gold
- Embroidery/thread motif
- Optional very small CZ detail

Do NOT:

- Put a giant CZ logo on the panda
- Turn the panda into a logo
- Dress the panda in unnecessary clothing
- Make the character look like a generic AI mascot

The panda itself is the character.

---

# 17. TAEBO ASSET STATES

Create a consistent visual character system.

Master:
`taebo-master-full-body`

Visual states:

- `taebo-idle`
- `taebo-greeting`
- `taebo-wave`
- `taebo-thinking`
- `taebo-help`
- `taebo-waiting`
- `taebo-success`
- `taebo-mobile`

All states must look like the SAME panda.

The master character must always be full body.

Derivative crops are allowed only for responsive presentation.

---

# 18. TAEBO GREETING

The existing test message shown in the screenshot:

"Need help with Do you deliver to a remote research station in Antarctica..."

must NOT be used as the normal production greeting.

Remove/replace only the visual/text presentation of the test state if that text is hard-coded as a UI demo.

Use a professional CZ Digitizing greeting consistent with the existing chatbot's actual functionality.

Do not change chatbot routing or logic.

---

# 19. TAEBO CHAT UI

The chat window should look like a premium CZ Digitizing component.

Header:
- Deep Navy
- Taebo name
- Panda/avatar
- Existing close/minimize controls

Body:
- White/light surface
- Clean message bubbles
- Navy text
- Gold accents

Quick actions/categories:
- Existing categories only
- Style them as premium pill/button controls

Input:
- Clean white input
- Light-gray border
- Gold focus
- Existing send action

Taebo may appear as:
- small full-body floating character beside the widget
- or a full-body character inside the opened chat panel

Do not let the character cover content.

---

# 20. IMAGE GENERATION / ASSET CREATION RULE

If the project environment does not contain a suitable Taebo image, DO NOT fake a realistic panda with CSS, emoji, generic icon, or a cartoon SVG.

Instead:

1. Determine whether the project already has an approved image-generation workflow.
2. If available, create a realistic full-body Taebo asset using that workflow.
3. If image generation is not available, clearly report that the visual asset is missing and identify the exact asset path/component that needs it.

Do not silently substitute an incorrect panda.

The required art direction is:

"Photorealistic full-body giant panda, natural black-and-white fur with highly detailed realistic texture, anatomically accurate proportions, friendly intelligent expression, standing naturally in a subtle three-quarter pose, premium studio photography/rendering, soft cinematic lighting, clean silhouette, isolated transparent background, sophisticated and approachable, no text, no logo, no clothing, no cartoon/anime/chibi styling."

---

# 21. RESPONSIVE DESIGN

Preserve all existing responsive functionality.

Visually optimize:

Mobile:
- compact header
- clean menu
- readable typography
- full-width actions
- responsive cards
- properly positioned Taebo

Tablet:
- adaptive grids
- balanced spacing

Desktop:
- reference-like premium composition

Large desktop:
- more whitespace
- controlled max-width
- no oversized empty areas

Never introduce horizontal scrolling.

---

# 22. DESIGN TOKENS

Use:

Deep Navy:
#0B132B

Slate Blue:
#4A5568

Light Gray:
#E5E7EB

Gold:
#D4AF37

White:
#FAFAFA

Headings:
Playfair Display

Body/UI:
Montserrat

Use the complete token definitions from `DESIGN_SYSTEM.md`.

---

# 23. HOW TO IMPLEMENT

Before editing any file:

1. Inspect the entire project structure.
2. Identify framework and styling system.
3. Identify global theme/styles.
4. Identify reusable components.
5. Identify customer components.
6. Identify admin components.
7. Identify authentication screens.
8. Identify Taebo component/assets.
9. Identify which files are visual-only.
10. Make a plan of UI-only files to modify.

Do not start by rewriting files blindly.

After identifying the visual layer, modify the smallest safe set of UI files.

Prefer:
- existing components
- existing CSS
- existing Tailwind classes
- existing design tokens
- existing assets
- existing layout components

Avoid:
- duplicate components
- duplicate styles
- architecture changes
- unnecessary dependencies

---

# 24. VISUAL ACCEPTANCE TEST

Do not consider the task complete merely because the application compiles.

Compare the final application visually against the supplied references.

### Customer

- [ ] Logo is prominent and correct
- [ ] Header feels premium
- [ ] Navigation is not cramped
- [ ] Hero is not a generic blue block
- [ ] Hero has strong embroidery visual storytelling
- [ ] Playfair Display is used correctly
- [ ] Montserrat is used correctly
- [ ] Gold accent is restrained
- [ ] Product cards look premium
- [ ] Services look premium
- [ ] Forms match brand
- [ ] Footer matches brand
- [ ] Login matches brand
- [ ] Account pages match brand
- [ ] Mobile design is polished

### Admin

- [ ] Admin login is branded
- [ ] Admin sidebar is premium navy
- [ ] Logo is correctly sized
- [ ] Active navigation is gold
- [ ] Dashboard is visually structured
- [ ] KPI cards look professional
- [ ] Tables are polished
- [ ] Forms are polished
- [ ] Status badges are consistent
- [ ] Reports are visually coherent
- [ ] Settings are coherent
- [ ] Responsive admin layout works

### Taebo

- [ ] Realistic panda
- [ ] Full-body master character
- [ ] Same panda across states
- [ ] No cartoon/anime/chibi appearance
- [ ] No test/Antarctica message
- [ ] Premium CZ-compatible presentation
- [ ] Correct chat positioning
- [ ] Mobile presentation works

---

# 25. FUNCTIONAL REGRESSION TEST

After the visual work, verify existing behavior:

- [ ] Customer navigation
- [ ] Search
- [ ] Categories
- [ ] Designs
- [ ] Design details
- [ ] Flip card
- [ ] Cart
- [ ] Checkout
- [ ] Payment
- [ ] Downloads
- [ ] Login
- [ ] Account
- [ ] Quotes
- [ ] Custom requests
- [ ] Notifications
- [Admin login
- [ ] Admin dashboard
- [ ] Orders
- [ ] Customers
- [ ] Designs
- [ ] Bundles
- [ ] Payments
- [ ] Services
- [ ] Quotes
- [ ] Uploads
- [ ] Reports
- [ ] Exports
- [ ] Settings
- [ ] Taebo chat

If any existing functionality breaks because of the redesign, fix the visual integration without changing the underlying business logic.

---

# 26. FINAL INSTRUCTION

Do NOT tell me that you have "implemented a modern design" unless it actually matches the supplied CZ Digitizing references.

Do NOT invent a generic SaaS dashboard.

Do NOT invent a generic blue landing page.

Do NOT create a generic chatbot mascot.

The target is specifically:

**CZ DIGITIZING**
**MACHINE EMBROIDERY DESIGN**

with:

**Deep Navy + Slate Blue + Light Gray + Gold + White**
**Playfair Display + Montserrat**
**Moon + Z + Needle + Gold Thread + Star**
**Premium embroidery visual language**
**Professional customer website**
**Professional admin dashboard**
**Realistic full-body panda character named Taebo**

MOST IMPORTANT:

### Preserve WHAT THE APPLICATION DOES.
### Change HOW THE APPLICATION LOOKS.

Before you finish, inspect the actual rendered pages and correct visual mismatches instead of assuming that changing a few CSS colors is sufficient.
