import { Module } from '@nestjs/common';
import { BundlesController } from './bundles.controller';
import { BundlesService } from './bundles.service';
import { DynamicBundleRulesController } from './dynamic-bundle-rules.controller';
import { DynamicBundleRulesService } from './dynamic-bundle-rules.service';

// Registration order matters: DynamicBundleRulesController's literal 'api/bundles/dynamic-rules'
// path must be matched before BundlesController's 'api/bundles/:id' param route, same reasoning
// as DesignsController's 'search'/'favorites' routes preceding ':id' (staff-visibility.util.ts's
// sibling comment).
@Module({
  controllers: [DynamicBundleRulesController, BundlesController],
  providers: [BundlesService, DynamicBundleRulesService],
  // BundlesService.computeBundleTotal() is reused by CartModule (apps/api/src/cart/cart.service.ts)
  // for bundle line-item pricing — the single source of truth for a bundle's AC-7 price-override sum.
  exports: [BundlesService],
})
export class BundlesModule {}
