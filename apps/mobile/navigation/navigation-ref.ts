import { createNavigationContainerRef } from '@react-navigation/native';
import type { RootTabParamList } from './types';

// docs/specs/2026-08-28-02-notifications-system.md AC-7 — a top-level ref so a notification-tap
// handler (lib/notification-deep-link.ts), which runs outside any screen component, can navigate
// imperatively once <NavigationContainer ref={navigationRef}> (App.tsx) has mounted.
export const navigationRef = createNavigationContainerRef<RootTabParamList>();
