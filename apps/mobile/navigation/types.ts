// docs/specs/2026-08-29-18-mobile-app-android-ios.md AC-1/§5 (aspect A-023) — route params for
// each stack navigator. Kept intentionally small: only the params each thin screen actually needs.
export type HomeStackParamList = {
  Home: undefined;
  DesignDetail: { designId: string };
  Cart: undefined;
};

export type CategoriesStackParamList = {
  Categories: undefined;
  CategoryDesigns: { categorySlug: string; categoryName: string };
  DesignDetail: { designId: string };
};

export type SearchStackParamList = {
  Search: undefined;
  DesignDetail: { designId: string };
};

export type CartStackParamList = {
  Cart: undefined;
  Checkout: undefined;
  BankTransfer: { orderId: string };
  OrderConfirmation: { orderId: string };
};

export type AccountStackParamList = {
  Account: undefined;
  Orders: undefined;
  PurchasedDesigns: undefined;
  Credits: undefined;
  Subscription: undefined;
  Notifications: undefined;
  LanguageSelect: undefined;
  Activity: undefined;
  Members: undefined;
  CustomRequests: undefined;
  CustomRequestDetail: { requestId: string };
};

// spec §5 Route(s): Services, Bundles, Pricing, Get a Quote, Custom Request — none of these are
// naturally "tabbed" content on web (top-level links, not persistent nav items), so mobile hosts
// them behind a 6th "More" tab rather than inventing a web route that doesn't exist.
export type MoreStackParamList = {
  More: undefined;
  Services: undefined;
  ServiceDetail: { slug: string };
  Bundles: undefined;
  BundleDetail: { bundleId: string };
  Pricing: undefined;
  Quote: { serviceSlug?: string } | undefined;
  CustomRequestNew: undefined;
};

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  ResetPassword: { token: string };
  VerifyDevice: { email: string };
  VerifyEmail: { token?: string };
};

export type AdminStackParamList = {
  AdminLogin: undefined;
  AdminTwoFactor: { challengeToken: string };
  AdminDashboard: undefined;
};

export type RootTabParamList = {
  HomeTab: undefined;
  CategoriesTab: undefined;
  SearchTab: undefined;
  CartTab: undefined;
  MoreTab: undefined;
  AccountTab: undefined;
};
