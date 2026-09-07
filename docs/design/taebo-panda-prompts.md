# Taebo Panda — Image Generation Prompts

Source prompts for the two photographic mascot assets consumed by
`apps/web/components/TaeboPanda.tsx`. Both prompts share identical fur-pattern/lighting/camera
language so the two crops read as the same individual panda; generate the full-body version first
and reuse its seed (or `--cref`, Midjourney) for the head-only version for best consistency.

## Assets

**2026-09-07 update:** switched to a single shared image, used uncropped in both placements, per
explicit direction not to crop the mascot differently per placement — the two-asset/two-prompt
setup below is kept for reference (still useful if you want to regenerate the artwork later) but
is no longer what the code actually loads.

| File | Used by |
|---|---|
| `apps/web/public/images/taebo-full.png` | `<TaeboPanda variant="full" />` and `<TaeboPanda variant="head" />` — same file, `object-contain` in both, no cropping |

This file is **not committed to the repo** (binary image asset) — drop the exported PNG into
`apps/web/public/images/taebo-full.png`. `TaeboPanda.tsx` falls back to a 🐼 emoji if it's missing,
so the site still renders cleanly in the meantime. A transparent background is expected (the mascot
sits directly on the page/chat background with no backdrop of its own).

## 1. Full-body prompt

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

**SDXL/Flux negative prompt:** `2D, 3D render, cartoon, cartoonish, anime, Pixar, Disney style, CGI, vector, flat illustration, digital painting, drawing, sketch, clip art, low-res, blurry subject, cropped body, cut-off legs, cut-off paws, cut-off ears, plush toy, stuffed animal, unrealistic proportions, smooth plastic texture, toy-like, painterly, watercolor, oversaturated colors, text, watermark, logo, extra limbs, deformed`

## 2. Head-only close-up prompt

> A hyper-realistic award-winning wildlife photograph, extreme close-up head-and-shoulders
> portrait of the same incredibly cute, healthy baby panda cub, looking directly into the camera
> lens with big, bright, glassy black eyes showing sharp natural catchlight reflections, head
> filling most of the frame, centered composition, symmetrical framing. Ultra-detailed fur
> texture, individual black and white hair strands clearly visible around the face and ears, soft
> natural fluff with realistic depth and volume, distinct black eye patches, black round fuzzy
> ears, white face fur, small black nose with visible texture and slight moisture sheen. Shot on a
> Canon EOS R5 with an 85mm f/1.4 portrait lens, professional studio lighting setup with a soft key
> light and gentle fill light, shallow depth of field, tack-sharp focus on the eyes and nose,
> background is a smooth out-of-focus neutral soft-grey studio backdrop, creamy bokeh,
> professional wildlife photography, National Geographic style, raw unedited photo, 8K resolution,
> physically-based realistic lighting, photojournalistic quality, photograph, not illustration,
> unedited RAW photo

**Midjourney:** `--ar 1:1 --style raw --stylize 50 --q 2 --no 2D, 3D render, cartoon, anime, Pixar, Disney, CGI, vector, illustration, digital painting, drawing, clip art, plush toy, stuffed animal, full body, wide shot, watermark, text`

**SDXL/Flux negative prompt:** `2D, 3D render, cartoon, cartoonish, anime, Pixar, Disney style, CGI, vector, flat illustration, digital painting, drawing, sketch, clip art, low-res, full body, wide shot, plush toy, stuffed animal, unrealistic proportions, smooth plastic texture, toy-like, painterly, watercolor, oversaturated colors, text, watermark, logo, deformed`

## Consistency tips

- Generate the full-body image first, note its seed, and reuse that exact seed for the head-only
  generation — the single biggest lever for both crops looking like the same panda.
- Midjourney: use `--cref <full-body-image-URL> --cw 100` on the head-only prompt to pull
  character features directly from the first image.
- Keep the fur-pattern sentence ("distinct black eye patches, black ears, black shoulder patch,
  white face and belly fur") word-for-word identical across both prompts.
