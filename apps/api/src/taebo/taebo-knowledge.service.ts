import { Injectable } from '@nestjs/common';
import type { FaqDto } from '@czd/shared-types';
import { FaqService } from '../faq/faq.service';
import { PrismaService } from '../prisma/prisma.service';

// One approved, customer-facing fact Taebo may ground an answer in. `id` is what the LLM cites
// back (e.g. "faq:11", "plan:2") so TaeboLlmMatchingService can verify every answer against real
// content instead of trusting the model's word for it.
export interface KnowledgeItem {
  id: string;
  title: string;
  text: string;
  faqId?: string;
}

export interface TaeboKnowledge {
  faqs: FaqDto[];
  items: KnowledgeItem[];
}

// Real, existing customer routes only (apps/web/app) — used so Taebo can point customers to the
// right section without inventing pages.
const SITE_PAGES: { path: string; purpose: string }[] = [
  { path: '/designs', purpose: 'Browse and buy ready-made machine embroidery designs' },
  { path: '/categories', purpose: 'Browse designs by category and subcategory' },
  { path: '/bundles', purpose: 'Design bundles (several related designs sold together)' },
  { path: '/services', purpose: 'Embroidery Digitizing and Vector Art services' },
  { path: '/pricing', purpose: 'Subscription plans and credit packages' },
  { path: '/get-a-quote', purpose: 'Request a price quote for a custom job' },
  { path: '/custom-request', purpose: 'Submit a custom embroidery digitizing or vector art request (upload your logo/artwork)' },
  { path: '/account/orders', purpose: 'Your orders, payment status and downloads (works for guest checkouts too)' },
  { path: '/account/purchased-designs', purpose: 'Purchased designs and their files (signed-in customers)' },
  { path: '/account/credits', purpose: 'Credit balance and history (signed-in customers)' },
  { path: '/account/subscription', purpose: 'Manage your subscription (signed-in customers)' },
  { path: '/faq', purpose: 'Frequently asked questions' },
  { path: '/tips', purpose: 'Tips for embroiderers' },
  { path: '/portfolio', purpose: 'Portfolio of past work' },
  { path: '/contact', purpose: 'Contact form, WhatsApp, email and social links' },
];

// The only site paths an LLM answer may mention (TaeboLlmMatchingService.isGrounded).
export const SITE_PAGE_PATHS = new Set(SITE_PAGES.map((p) => p.path));

const CACHE_TTL_MS = 60_000;

// Builds Taebo's grounding context from content Admin has already published elsewhere on the site
// (FAQ, services, pricing, Get-a-Quote answers, contact settings) — nothing here is authored for
// Taebo specifically, so Taebo can never say something the website itself doesn't already say.
// Customer/account data is deliberately never included.
@Injectable()
export class TaeboKnowledgeService {
  private cache: { at: number; value: TaeboKnowledge } | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly faqService: FaqService,
  ) {}

  async load(): Promise<TaeboKnowledge> {
    if (this.cache && Date.now() - this.cache.at < CACHE_TTL_MS) return this.cache.value;
    const value = await this.build();
    this.cache = { at: Date.now(), value };
    return value;
  }

  private async build(): Promise<TaeboKnowledge> {
    // All languages, not just the customer's: FAQ content is mostly authored in English, and
    // filtering by the UI language would leave a Urdu/Arabic visitor with no grounding at all. The
    // LLM answers in the customer's language from whichever entry fits.
    const [faqs, services, quoteQuestions, plans, packages, settings] = await Promise.all([
      this.faqService.listTaeboVisible(),
      this.prisma.service.findMany({ where: { isPublished: true }, orderBy: [{ type: 'asc' }, { sortOrder: 'asc' }] }),
      this.prisma.quoteQuestion.findMany({ where: { isPublished: true, service: { isPublished: true } }, include: { service: true } }),
      this.prisma.subscriptionPlan.findMany({ where: { isPublished: true } }),
      this.prisma.creditPackage.findMany({ where: { isPublished: true } }),
      this.prisma.platformSettings.findUnique({ where: { id: 1 } }),
    ]);

    const items: KnowledgeItem[] = [];
    for (const f of faqs) items.push({ id: `faq:${f.id}`, title: f.question, text: f.answer, faqId: f.id });

    // Admin data has duplicate service names (e.g. two "Embroidery Digitizing" rows) — keep one.
    const seenServices = new Set<string>();
    for (const s of services) {
      const key = s.name.trim().toLowerCase();
      if (seenServices.has(key)) continue;
      seenServices.add(key);
      const kind = s.type === 'vector_art' ? 'Vector Art service' : 'Embroidery Digitizing service';
      items.push({ id: `service:${s.id}`, title: `${s.name} (${kind})`, text: [s.description, s.applications].filter(Boolean).join(' Applications: ') });
    }
    for (const q of quoteQuestions) {
      items.push({ id: `quote:${q.id}`, title: `${q.service.name}: ${q.question}`, text: q.answer });
    }
    for (const p of plans) {
      const logos = p.logoLimit === null ? '' : `, ${p.logoLimit} logo downloads per cycle`;
      const perks = p.perks.length ? ` Perks: ${p.perks.join('; ')}.` : '';
      items.push({
        id: `plan:${p.id}`,
        title: `Subscription plan: ${p.name}`,
        text: `PKR ${p.pricePkr.toString()} per ${p.billingPeriod === 'yearly' ? 'year' : 'month'}, ${p.monthlyCredits} credits per month${logos}.${perks} See /pricing.`,
      });
    }
    for (const c of packages) {
      const bonus = c.bonusCredits ? ` + ${c.bonusCredits} bonus credits` : '';
      items.push({ id: `package:${c.id}`, title: `Credit package: ${c.name}`, text: `${c.credits} credits${bonus} for PKR ${c.pricePkr.toString()} (one-time, no subscription). See /pricing.` });
    }
    if (settings?.whatsappNumber || settings?.contactEmail) {
      const parts = [settings.whatsappNumber && `WhatsApp ${settings.whatsappNumber}`, settings.contactEmail && `email ${settings.contactEmail}`].filter(Boolean);
      items.push({ id: 'contact', title: 'How to contact the CZ Digitizing team', text: `${parts.join(', ')}, or the Contact page (/contact).` });
    }
    items.push({ id: 'pages', title: 'Website sections', text: SITE_PAGES.map((p) => `${p.path} — ${p.purpose}`).join('\n') });

    return { faqs, items };
  }
}
