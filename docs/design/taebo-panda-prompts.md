# Taebo Panda — Image Generation Prompts

Source prompts for the Taebo character assets consumed by `apps/web/components/TaeboPanda.tsx`.

## 2026-09-13 update — official reference supplied, character identity changed

The 2026-09-07 "baby panda cub, sitting, no clothing" concept below (kept for history) is
**superseded**. A supplied reference image is now the visual source of truth
(`docs/specs/2026-08-28-15-taebo-chatbot.md` §10, `.claude/skills/cz-digitizing-design/readme.md`'s
TAEBO section): Taebo is a **standing, adult-proportioned realistic panda**, three-quarter/front
pose, wearing a fitted deep-navy vest with a thin gold trim/zipper and a small CZ-badge lanyard,
sometimes holding a tablet/notebook. Same anti-cartoon requirements as before (photographic
realism, no anime/chibi/plush styling), different pose/wardrobe than the original cub concept.

**Update, later the same day (2026-09-13):** the master asset was found saved locally (Admin had
exported it from the chat as a ChatGPT-generated PNG) and is now in place at
`apps/web/public/images/taebo-full.png` (mirrored into
`.claude/skills/cz-digitizing-design/assets/taebo-full.png` for the design-system guideline card).
It has a dark studio-vignette background rather than true alpha transparency, and is committed to
git at ~2.3MB uncompressed (matching this repo's own precedent — `apps/web/public/brand/logo-*.png`
are committed the same way) — both the vignette and the file size are flagged as follow-ups
(background removal, recompression), neither blocking. `TaeboPanda.tsx`'s fallback chain (pose
asset → this master → 🐼 emoji) still applies for any future page that ever outlives this specific
file, or for any of the pose-specific files below before they're supplied.

### Required files

Existing convention (`apps/web/public/images/`, not a new folder) — committed the same way as this
app's other static image assets once supplied:

| File | Required? | Content |
|---|---|---|
| `taebo-full.png` | **Yes — master. Present as of 2026-09-13.** | Full-body standing panda, the supplied reference image itself |
| `taebo-idle.png` | Optional, not yet supplied | Calm standing pose, relaxed arms |
| `taebo-greeting.png` | Optional | Waving pose |
| `taebo-thinking.png` | Optional | Hand near chin, thoughtful expression |
| `taebo-helping.png` | Optional | Presenting/pointing, holding the tablet |
| `taebo-waiting.png` | Optional | Attentive/checking pose |
| `taebo-success.png` | Optional | Thumbs-up or similarly positive pose |
| `taebo-mobile.png` | Optional, cosmetic | Any of the above, if a distinct crop is wanted for small screens — CSS already handles functional mobile sizing regardless |

Every optional file falls back to `taebo-full.png` (same character, no visible pose change) if
absent, and that in turn falls back to the 🐼 emoji if even the master is missing — see
`TaeboPanda.tsx`'s `resolveSource()`. Nothing here needs to exist for the site to render correctly;
supplying more of them only adds pose variety.

### Generation prompt (if the master needs to be produced rather than exported from the reference)

> A hyper-realistic, premium studio photograph (or equivalent high-quality 3D render) of a single
> adult giant panda standing upright in a natural three-quarter pose, full body visible from head to
> paws, nothing cropped or cut off. Wearing a neatly fitted deep navy vest/jacket with a thin gold
> trim along the zipper and collar, and a small rectangular CZ badge on a short lanyard at chest
> height — no other clothing, no hat, no giant logo. Realistic black-and-white fur with detailed,
> individually visible texture, natural round ears, natural paws (one may hold a slim black
> tablet/notebook), realistic dark eyes with a friendly, intelligent, approachable expression —
> professional, not cutesy or childlike. Soft cinematic studio lighting, shallow depth of field,
> clean isolated background suitable for a transparent cutout, photojournalistic/premium-render
> quality, 8K resolution. No text, no additional logos, no cartoon/anime/chibi/plush styling, no
> human features, no fantasy elements.

**Negative prompt (SDXL/Flux/Midjourney `--no`):** `cartoon, anime, chibi, plush toy, stuffed
animal, 2D, flat illustration, vector, clip art, toy-like, giant head, human/panda hybrid, fantasy
creature, low-resolution, cropped body, cut-off paws, cut-off ears, watermark, text, logo covering
the character, extra limbs, deformed`

Generate one pose at a time and reuse the same seed/`--cref` (Midjourney) across every pose so all
seven read as the same individual panda — the single biggest lever for consistency, same principle
as the superseded prompts below used for their two crops.

---

## Superseded (2026-09-07) — kept for history only, do not use

The original setup used a single shared "baby panda cub, sitting" image for both the full-body
mascot and the head-only chat avatar crop. This concept is no longer approved — see the 2026-09-13
update above for the current official character. Prompts kept below only so the earlier decision
and its reasoning stay auditable.

> A hyper-realistic award-winning wildlife photograph of a single incredibly cute, healthy baby
> panda cub, full body, sitting comfortably on the ground with both front paws visible resting on
> the floor, looking directly into the camera lens with big, bright, glassy black eyes showing
> sharp natural catchlight reflections. Entire body in frame from the top of its round fuzzy ears
> down to its paws, nothing cropped or cut off, centered composition. Ultra-detailed fur texture
> across the whole body, individual black and white hair strands clearly visible, soft natural
> fluff with realistic depth, volume, and slight fur static, distinct black eye patches, black
> ears, black shoulder patch, white face and belly fur. Shot on a Canon EOS R5 with an 85mm f/1.4
> portrait lens, professional studio lighting setup with a soft key light and gentle fill light,
> shallow depth of field, tack-sharp focus on the panda's face and eyes, background is a smooth
> out-of-focus neutral soft-grey studio backdrop, creamy bokeh, professional wildlife photography,
> National Geographic style, raw unedited photo, 8K resolution, physically-based realistic
> lighting, photojournalistic quality, photograph, not illustration, unedited RAW photo

**Midjourney:** `--ar 4:5 --style raw --stylize 50 --q 2 --no 2D, 3D render, cartoon, anime, Pixar, Disney, CGI, vector, illustration, digital painting, drawing, clip art, plush toy, stuffed animal, cropped body, cut-off legs, cut-off paws, watermark, text`
