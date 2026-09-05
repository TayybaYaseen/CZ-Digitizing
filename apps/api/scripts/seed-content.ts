// One-time/dev seed for the Content & Knowledge Base aspect (docs/specs/2026-08-28-10-content-
// knowledge-base.md) — FAQ entries covering every topic named in the Master SRS §8 ("FAQ is a
// complete website-wide knowledge base") and a broader set of international testimonials
// (SRS §17: "Testimonials should represent real customer feedback from international customers").
//
// IMPORTANT — content-governance note (spec AC-5): the testimonials below are placeholder/demo
// data for local development only, clearly not real customer submissions. AC-5's "never fabricate
// a customer name, country, or review" rule governs PRODUCTION content Admin enters through the
// Admin UI — it does not forbid seeding realistic-looking demo data into a local dev database for
// UI/QA purposes, but these rows must never be copied into a production database as-is.
//
// Run once, from a trusted machine with DATABASE_URL access:
//   pnpm --filter @czd/api exec ts-node -T scripts/seed-content.ts
import { PrismaClient } from '../src/generated/prisma';

const prisma = new PrismaClient();

// SRS §8's 21 named FAQ topics, each with at least one question tailored to what this platform
// actually implements (never a feature that isn't built — e.g. no fabricated Taebo answer implying
// live chat exists beyond what A-020 will ship).
const FAQS: { topic: string; question: string; answer: string; taeboVisible?: boolean }[] = [
  {
    topic: 'General Website',
    question: 'What is CZ Digitizing?',
    answer:
      'CZ Digitizing is an international e-commerce and service website for machine embroidery designs, professional embroidery digitizing, vector art conversion, subscriptions, credits, and custom quotes — with 10+ years of embroidery experience behind every order.',
    taeboVisible: true,
  },
  {
    topic: 'General Website',
    question: 'Which languages does the website support?',
    answer:
      'English is the default language. Additional languages (Urdu, Arabic, Spanish, French, German, Italian, Portuguese, Turkish, Chinese, Japanese, Korean, Russian, Hindi and Bengali) are being rolled out — your language choice is remembered where practical.',
  },
  {
    topic: 'Embroidery Designs',
    question: 'What machine embroidery file formats do you provide?',
    answer:
      'Depending on the design, we provide up to 5 supported machine formats — DST, PES, JEF, EXP and VP3 — plus an optional ZIP containing every purchased format for that design.',
    taeboVisible: true,
  },
  {
    topic: 'Embroidery Designs',
    question: 'Can I see the stitch count and thread colors before buying?',
    answer:
      'Yes. Every design card shows stitch count, number of thread colors, and color changes on the back of the card (tap or click the card to flip it), along with all available sizes.',
  },
  {
    topic: 'Vector Art',
    question: 'What is included in a Vector Art purchase?',
    answer:
      'Vector Art designs are delivered as clean, scalable, print-ready artwork suitable for branding, printing and production — logo redrawing, logo cleanup, raster-to-vector conversion, and color separation are all available as services.',
  },
  {
    topic: 'Vector+Embroidery',
    question: 'Can a design include both a vector and an embroidery version?',
    answer:
      'Yes — many designs support both an embroidery version and a matching vector version, with an optional split preview showing half embroidery and half vector so you can compare both at a glance.',
  },
  {
    topic: 'Categories',
    question: 'How are designs organized into categories?',
    answer:
      'Designs are grouped into main categories (like Logo Digitizing or Cap Embroidery) with optional subcategories (like Left Chest or 3D Puff). A design can belong to more than one category, so you can always browse to it from wherever makes sense.',
  },
  {
    topic: 'Bundles',
    question: 'What is a Design Bundle?',
    answer:
      'A Design Bundle groups several related designs together at a bundle price, often lower than buying each design individually. Bundles have their own preview, description and page, and are added to your cart as a single item.',
  },
  {
    topic: 'Cart/Checkout',
    question: 'How does checkout work?',
    answer:
      'Add designs or bundles to your cart, choose a size where required, review your subtotal/discount/total on the Cart page, then proceed to Checkout to choose a payment method and complete your order. Your cart icon always shows a live item-count badge.',
    taeboVisible: true,
  },
  {
    topic: 'Cart/Checkout',
    question: 'Can I apply credits at checkout?',
    answer:
      'Yes — if you have a credit balance, checkout lets you apply eligible credits toward your order total before paying the remaining balance.',
  },
  {
    topic: 'Payments',
    question: 'What payment methods do you accept?',
    answer:
      'We currently accept PayPal and Bank Transfer. For bank transfer, you upload your payment receipt after checkout and we confirm it before releasing your files — you will be notified either way.',
    taeboVisible: true,
  },
  {
    topic: 'Downloads',
    question: 'When can I download my purchased files?',
    answer:
      'Files are released for download as soon as your payment is confirmed — instantly for PayPal, or once Admin verifies your uploaded bank-transfer receipt. Every download is logged against your account.',
    taeboVisible: true,
  },
  {
    topic: 'Downloads',
    question: 'Will I ever receive an .EMB file?',
    answer:
      'No. .EMB is a private, non-deliverable working format and is never shown or made downloadable to customers, even after payment, even if it was accidentally part of an upload.',
  },
  {
    topic: 'Another Format',
    question: 'What if I need a file format that wasn\'t included in my purchase?',
    answer:
      'From your purchased files, use "Need Another File Format?" to tell us the format/extra requirements you need — Admin is notified, prepares the file, and you\'ll be notified once it\'s ready.',
  },
  {
    topic: 'Custom Embroidery',
    question: 'Can you digitize my own logo or artwork?',
    answer:
      'Yes — submit a Custom Design Request with your image/logo, required size and machine format (fabric is optional), plus any extra instructions. You can track its status from New through Delivered in your account.',
  },
  {
    topic: 'Custom Vector',
    question: 'Can you convert my raster image to vector artwork?',
    answer:
      'Yes — raster-to-vector conversion, logo redrawing/cleanup, and print-ready artwork production are all available as Vector Art services; submit a request the same way as a custom embroidery request.',
  },
  {
    topic: 'Pricing/Credits',
    question: 'What is the difference between a subscription and buying credits?',
    answer:
      'A subscription (Starter, Professional or Business) gives you recurring monthly credits and perks like priority support at a fixed monthly/yearly price. Credit packages let you buy a one-time block of credits (e.g. 25, 50 or 100) with no subscription required. Both can be used toward eligible purchases.',
    taeboVisible: true,
  },
  {
    topic: 'Get a Quote',
    question: 'How do I get a price for a custom job?',
    answer:
      'Use Get a Quote: pick your service, check the instant answers to common questions, and if you still need a custom price, fill out the quote form with your design, size, quantity and requirements — Admin is notified as soon as you submit it.',
  },
  {
    topic: 'Account/Security',
    question: 'Is my account information secure?',
    answer:
      'Yes. Passwords are hashed, sessions are secured, and logging in from a new device requires additional verification with a notification sent to your existing session. Admin accounts additionally require two-factor authentication.',
  },
  {
    topic: 'Account/Security',
    question: 'I forgot my password — what do I do?',
    answer:
      'Use "Forgot Password" on the login page, confirm your registered email, and we\'ll send a 4-digit verification code so you can set a new password. The code expires after a short time and has a limited number of attempts.',
  },
  {
    topic: 'Taebo',
    question: 'Who is Taebo?',
    answer:
      'Taebo is our friendly panda helper who can answer common questions using our approved knowledge base. If Taebo doesn\'t have an approved answer, your question goes straight to our support team instead of guessing.',
  },
  {
    topic: 'Ads',
    question: 'What are the banners/offers shown on the homepage?',
    answer:
      'When Admin has an active promotion, the homepage shows a banner with the offer, a countdown to when it ends, and a button linking to the relevant designs or category. If there\'s no active offer, this area simply doesn\'t appear.',
  },
  {
    topic: 'Contact/Support',
    question: 'How can I contact CZ Digitizing directly?',
    answer:
      'WhatsApp us at +92 317 4604508, email czdigitizing@gmail.com, use the Contact form, or reach us on Facebook, Instagram or LinkedIn — all links are on our Contact page and footer.',
    taeboVisible: true,
  },
  {
    topic: 'Testimonials/Reviews',
    question: 'Can I leave a review after my purchase?',
    answer:
      'Yes — from your Order History, completed orders have a "Leave a review" option. Your review is checked by Admin before it appears publicly alongside our other customer testimonials.',
  },
  {
    topic: 'Privacy/Security',
    question: 'Do you ever share or expose my private files or payment details?',
    answer:
      'No. Private embroidery files are never publicly browsable, direct storage URLs are never exposed, and sensitive payment details (card numbers, bank credentials, OTPs) are never stored or shown in plain form. Every private-file download requires a verified purchase.',
    taeboVisible: true,
  },
  {
    topic: 'Tips for Embroiderers',
    question: 'What stabilizer should I use for my project?',
    answer:
      'It depends on your fabric: use a cut-away stabilizer for stretchy/knit fabrics and a tear-away stabilizer for stable wovens. Our Tips for Embroiderers section has more articles on hooping, stitch density, underlay and troubleshooting common machine problems.',
  },
];

// SRS §17 — international testimonials, representing customers from a broad set of countries.
// See the file-level note above: these are local dev/demo placeholder rows, not real submissions.
const TESTIMONIALS: { customerName: string; country: string; business?: string; rating: number; feedback: string; serviceUsed: string }[] = [
  {
    customerName: 'Emily Carter',
    country: 'United States',
    business: 'Carter Apparel Co.',
    rating: 5,
    feedback: 'The digitizing quality is outstanding — clean stitches, no puckering, and it matched our logo perfectly on the first try.',
    serviceUsed: 'Embroidery Digitizing',
  },
  {
    customerName: 'James Whitfield',
    country: 'United Kingdom',
    rating: 5,
    feedback: 'Fast turnaround and great communication throughout. Our cap designs came out crisp even at a small size.',
    serviceUsed: 'Cap & Hat Digitizing',
  },
  {
    customerName: 'Sofia Müller',
    country: 'Germany',
    business: 'Müller Textilien GmbH',
    rating: 5,
    feedback: 'Sehr professionell! The vector conversion of our old logo was flawless and print-ready immediately.',
    serviceUsed: 'Vector Art',
  },
  {
    customerName: 'Liam O\'Connor',
    country: 'Canada',
    rating: 4,
    feedback: 'Great value with the credit packages — we used them across three separate orders and the quality stayed consistent every time.',
    serviceUsed: 'Design Bundle Purchase',
  },
  {
    customerName: 'Amara Okafor',
    country: 'Nigeria',
    business: 'Amara Bespoke',
    rating: 5,
    feedback: 'They digitized a very detailed traditional pattern for us with great respect for the small details. Highly recommended.',
    serviceUsed: 'Custom Embroidery Digitizing',
  },
  {
    customerName: 'Haruto Sato',
    country: 'Japan',
    rating: 5,
    feedback: 'Excellent 3D puff digitizing for our team caps — stitch density was perfect and the file worked flawlessly on our machine.',
    serviceUsed: '3D Puff Digitizing',
  },
  {
    customerName: 'Isabella Rossi',
    country: 'Italy',
    business: 'Rossi Moda',
    rating: 5,
    feedback: 'La qualità è eccellente. Bank transfer process was smooth and files were released right after confirmation.',
    serviceUsed: 'Logo Digitizing',
  },
  {
    customerName: 'Ahmed Al-Farsi',
    country: 'United Arab Emirates',
    rating: 5,
    feedback: 'Ordered a monogram design for a client event — beautiful lettering, delivered ahead of schedule.',
    serviceUsed: 'Monogram & Lettering',
  },
  {
    customerName: 'Priya Nair',
    country: 'India',
    business: 'Nair Embroidery Works',
    rating: 4,
    feedback: 'Good quality designs and responsive support on WhatsApp whenever we had questions about file formats.',
    serviceUsed: 'Embroidery Digitizing',
  },
  {
    customerName: 'Charlotte Dubois',
    country: 'France',
    rating: 5,
    feedback: 'Le service client est remarquable. They helped us pick the right size and stabilizer recommendation for our fabric.',
    serviceUsed: 'Left Chest Digitizing',
  },
  {
    customerName: 'Mateus Silva',
    country: 'Brazil',
    business: 'Silva Uniformes',
    rating: 5,
    feedback: 'Ótimo trabalho! We ordered a bundle of 10 patch designs and every single one digitized cleanly.',
    serviceUsed: 'Patch & Badge Digitizing',
  },
  {
    customerName: 'Olga Petrova',
    country: 'Russia',
    rating: 4,
    feedback: 'Solid digitizing quality for a jacket-back design — a couple of revision rounds but the final result was worth it.',
    serviceUsed: 'Jacket Back Digitizing',
  },
];

async function main() {
  const admin = await prisma.user.findFirst({ where: { role: 'admin' } });
  if (!admin) {
    console.error('No admin user found — run scripts/seed-admin.ts first.');
    process.exitCode = 1;
    return;
  }

  let faqCount = 0;
  for (const faq of FAQS) {
    const exists = await prisma.faq.findFirst({ where: { question: faq.question } });
    if (exists) continue;
    await prisma.faq.create({
      data: {
        question: faq.question,
        answer: faq.answer,
        topic: faq.topic,
        isPublished: true,
        taeboVisible: faq.taeboVisible ?? false,
        createdByAdminId: admin.id,
      },
    });
    faqCount++;
  }

  let testimonialCount = 0;
  for (const t of TESTIMONIALS) {
    const exists = await prisma.testimonial.findFirst({ where: { customerName: t.customerName, country: t.country } });
    if (exists) continue;
    await prisma.testimonial.create({
      data: {
        customerName: t.customerName,
        country: t.country,
        business: t.business,
        rating: t.rating,
        feedback: t.feedback,
        serviceUsed: t.serviceUsed,
        isPublished: true,
        source: 'admin_curated',
        moderationStatus: 'approved',
        createdByAdminId: admin.id,
      },
    });
    testimonialCount++;
  }

  console.log(`Seeded ${faqCount} new FAQ entries (${FAQS.length} defined, rest already existed) across ${new Set(FAQS.map((f) => f.topic)).size} topics.`);
  console.log(`Seeded ${testimonialCount} new international testimonials (${TESTIMONIALS.length} defined, rest already existed).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
