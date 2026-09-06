import { HomeTestimonials } from '@/components/HomeTestimonials';
import { GetAQuoteCta } from '@/components/home/GetAQuoteCta';
import { HeaderMediaBanner } from '@/components/home/HeaderMediaBanner';
import { Hero } from '@/components/home/Hero';
import { HomeSections } from '@/components/home/HomeSections';
import { PromoStrip } from '@/components/home/PromoStrip';
import { ServicesSummary } from '@/components/home/ServicesSummary';

// docs/specs/2026-09-01-20-landing-page-experience.md §5.1 — section order is fixed by SRS §5 and
// not Admin-reorderable at this top level: Header (layout.tsx) -> PromoStrip -> HeaderMediaBanner
// (A-018c, not in the spec's own §5.1 diagram but given a real consuming page here rather than
// leaving its backend unused) -> Hero -> HomeSections -> ServicesSummary -> Testimonials ->
// Get-a-Quote CTA -> Footer (layout.tsx). AC-8 — hero/services/Get-a-Quote/footer are always
// present; only PromoStrip/HeaderMediaBanner/HomeSections/HomeTestimonials omit themselves when
// their source has no published content.
export default function HomePage() {
  return (
    <div className="-m-6 space-y-12 pb-12">
      <PromoStrip />
      <div className="space-y-12 px-6 pt-6">
        <HeaderMediaBanner />
        <Hero />
        <HomeSections />
        <ServicesSummary />
        <HomeTestimonials />
        <GetAQuoteCta />
      </div>
    </div>
  );
}
