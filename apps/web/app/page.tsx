import { HomeTestimonials } from '@/components/HomeTestimonials';
import { GetAQuoteCta } from '@/components/home/GetAQuoteCta';
import { HomeOrders } from '@/components/home/HomeOrders';
import { Hero } from '@/components/home/Hero';
import { HomeSections } from '@/components/home/HomeSections';
import { PromoStrip } from '@/components/home/PromoStrip';
import { ServicesSummary } from '@/components/home/ServicesSummary';

// docs/specs/2026-09-01-20-landing-page-experience.md §5.1 — section order is fixed by SRS §5 and
// not Admin-reorderable at this top level: Header (layout.tsx) -> PromoStrip -> Hero (whose
// background media is the Admin's active Header Media, A-018c) -> HomeSections -> ServicesSummary
// -> Testimonials -> Get-a-Quote CTA -> Footer (layout.tsx). AC-8 — hero/services/Get-a-Quote/footer
// are always present; only PromoStrip/HomeSections/HomeTestimonials omit themselves when their
// source has no published content.
// HomeOrders (guest checkout) sits first in the content area so a returning buyer — signed in or a
// guest on the browser they ordered from — finds their order at once; it renders nothing at all for
// a visitor with no orders, so the landing page itself is unchanged for them.
export default function HomePage() {
  return (
    <div className="-m-6 space-y-12 pb-12">
      <PromoStrip />
      <div className="space-y-12 px-6 pt-6">
        <HomeOrders />
        <Hero />
        <HomeSections />
        <ServicesSummary />
        <HomeTestimonials />
        <GetAQuoteCta />
      </div>
    </div>
  );
}
