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
  AccountTab: undefined;
};
