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
})
export class BundlesModule {}
