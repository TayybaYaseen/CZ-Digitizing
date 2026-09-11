import { useEffect, useState } from 'react';
import { Linking, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuth } from '../lib/auth-context';
import { TaeboWidget } from '../components/TaeboWidget';
import { HomeScreen } from '../screens/HomeScreen';
import { SearchScreen } from '../screens/SearchScreen';
import { CategoriesScreen } from '../screens/CategoriesScreen';
import { CategoryDesignsScreen } from '../screens/CategoryDesignsScreen';
import { DesignDetailScreen } from '../screens/DesignDetailScreen';
import { CartScreen } from '../screens/CartScreen';
import { CheckoutScreen } from '../screens/CheckoutScreen';
import { BankTransferScreen } from '../screens/BankTransferScreen';
import { OrderConfirmationScreen } from '../screens/OrderConfirmationScreen';
import { ServicesScreen } from '../screens/ServicesScreen';
import { ServiceDetailScreen } from '../screens/ServiceDetailScreen';
import { BundlesScreen } from '../screens/BundlesScreen';
import { BundleDetailScreen } from '../screens/BundleDetailScreen';
import { PricingScreen } from '../screens/PricingScreen';
import { QuoteScreen } from '../screens/QuoteScreen';
import { CustomRequestScreen } from '../screens/CustomRequestScreen';
import { MoreScreen } from '../screens/more/MoreScreen';
import { AccountScreen } from '../screens/account/AccountScreen';
import { OrdersScreen } from '../screens/account/OrdersScreen';
import { PurchasedDesignsScreen } from '../screens/account/PurchasedDesignsScreen';
import { CreditsScreen } from '../screens/account/CreditsScreen';
import { SubscriptionScreen } from '../screens/account/SubscriptionScreen';
import { NotificationsScreen } from '../screens/account/NotificationsScreen';
import { LanguageSelectScreen } from '../screens/account/LanguageSelectScreen';
import { ActivityScreen } from '../screens/account/ActivityScreen';
import { MembersScreen } from '../screens/account/MembersScreen';
import { CustomRequestsScreen } from '../screens/account/CustomRequestsScreen';
import { CustomRequestDetailScreen } from '../screens/account/CustomRequestDetailScreen';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { RegisterScreen } from '../screens/auth/RegisterScreen';
import { ForgotPasswordScreen } from '../screens/auth/ForgotPasswordScreen';
import { ResetPasswordScreen } from '../screens/auth/ResetPasswordScreen';
import { VerifyDeviceScreen } from '../screens/auth/VerifyDeviceScreen';
import { VerifyEmailScreen } from '../screens/auth/VerifyEmailScreen';
import { AdminLoginScreen } from '../screens/admin/AdminLoginScreen';
import { AdminTwoFactorScreen } from '../screens/admin/AdminTwoFactorScreen';
import { AdminDashboardScreen } from '../screens/admin/AdminDashboardScreen';
import type {
  AccountStackParamList,
  AuthStackParamList,
  CartStackParamList,
  CategoriesStackParamList,
  HomeStackParamList,
  MoreStackParamList,
  SearchStackParamList,
} from './types';

// docs/specs/2026-08-29-18-mobile-app-android-ios.md AC-1 (aspect A-023) — bottom tabs (Home,
// Categories, Search, Cart, Account), each its own stack navigator so e.g. Home -> Design Detail
// -> Cart is a normal push, matching architecture's React Navigation stack.
const HomeStack = createNativeStackNavigator<HomeStackParamList>();
const CategoriesStack = createNativeStackNavigator<CategoriesStackParamList>();
const SearchStack = createNativeStackNavigator<SearchStackParamList>();
const CartStack = createNativeStackNavigator<CartStackParamList>();
const AccountStack = createNativeStackNavigator<AccountStackParamList>();
const MoreStack = createNativeStackNavigator<MoreStackParamList>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const AdminStack = createNativeStackNavigator<import('./types').AdminStackParamList>();
const Tabs = createBottomTabNavigator();

function HomeStackNavigator() {
  return (
    <HomeStack.Navigator>
      <HomeStack.Screen name="Home" component={HomeScreen} />
      <HomeStack.Screen name="DesignDetail" component={DesignDetailScreen} options={{ title: 'Design' }} />
      <HomeStack.Screen name="Cart" component={CartScreen} />
    </HomeStack.Navigator>
  );
}

function CategoriesStackNavigator() {
  return (
    <CategoriesStack.Navigator>
      <CategoriesStack.Screen name="Categories" component={CategoriesScreen} />
      <CategoriesStack.Screen name="CategoryDesigns" component={CategoryDesignsScreen} options={({ route }) => ({ title: route.params.categoryName })} />
      <CategoriesStack.Screen name="DesignDetail" component={DesignDetailScreen} options={{ title: 'Design' }} />
    </CategoriesStack.Navigator>
  );
}

function SearchStackNavigator() {
  return (
    <SearchStack.Navigator>
      <SearchStack.Screen name="Search" component={SearchScreen} />
      <SearchStack.Screen name="DesignDetail" component={DesignDetailScreen} options={{ title: 'Design' }} />
    </SearchStack.Navigator>
  );
}

function CartStackNavigator() {
  return (
    <CartStack.Navigator>
      <CartStack.Screen name="Cart" component={CartScreen} />
      <CartStack.Screen name="Checkout" component={CheckoutScreen} />
      <CartStack.Screen name="BankTransfer" component={BankTransferScreen} options={{ title: 'Bank Transfer' }} />
      <CartStack.Screen name="OrderConfirmation" component={OrderConfirmationScreen} options={{ title: 'Order Placed', headerBackVisible: false }} />
    </CartStack.Navigator>
  );
}

function AccountStackNavigator() {
  return (
    <AccountStack.Navigator>
      <AccountStack.Screen name="Account" component={AccountScreen} />
      <AccountStack.Screen name="Orders" component={OrdersScreen} />
      <AccountStack.Screen name="PurchasedDesigns" component={PurchasedDesignsScreen} options={{ title: 'Purchased Designs' }} />
      <AccountStack.Screen name="Credits" component={CreditsScreen} />
      <AccountStack.Screen name="Subscription" component={SubscriptionScreen} />
      <AccountStack.Screen name="Notifications" component={NotificationsScreen} />
      <AccountStack.Screen name="LanguageSelect" component={LanguageSelectScreen} options={{ title: 'Language' }} />
      <AccountStack.Screen name="Activity" component={ActivityScreen} />
      <AccountStack.Screen name="Members" component={MembersScreen} options={{ title: 'Shared Account Members' }} />
      <AccountStack.Screen name="CustomRequests" component={CustomRequestsScreen} options={{ title: 'My Custom Requests' }} />
      <AccountStack.Screen name="CustomRequestDetail" component={CustomRequestDetailScreen} options={{ title: 'Request' }} />
    </AccountStack.Navigator>
  );
}

// spec §5 Route(s): Services, Bundles, Pricing, Get a Quote, Custom Request — see navigation/
// types.ts's own doc comment on MoreStackParamList for why these live behind a 6th tab.
function MoreStackNavigator() {
  return (
    <MoreStack.Navigator>
      <MoreStack.Screen name="More" component={MoreScreen} options={{ title: 'More' }} />
      <MoreStack.Screen name="Services" component={ServicesScreen} />
      <MoreStack.Screen name="ServiceDetail" component={ServiceDetailScreen} options={{ title: 'Service' }} />
      <MoreStack.Screen name="Bundles" component={BundlesScreen} options={{ title: 'Design Bundles' }} />
      <MoreStack.Screen name="BundleDetail" component={BundleDetailScreen} options={{ title: 'Bundle' }} />
      <MoreStack.Screen name="Pricing" component={PricingScreen} />
      <MoreStack.Screen name="Quote" component={QuoteScreen} options={{ title: 'Get a Quote' }} />
      <MoreStack.Screen name="CustomRequestNew" component={CustomRequestScreen} options={{ title: 'Custom Request' }} />
    </MoreStack.Navigator>
  );
}

// AC-1/§5 — Taebo is a floating widget available from every customer screen (mirrors web's
// once-in-layout.tsx mounting), not a tab of its own; it sits as a sibling over the tab navigator
// so it stays visible across every tab, exactly like web's fixed bottom-right widget stays visible
// across every page.
function CustomerTabs() {
  return (
    <View style={{ flex: 1 }}>
      <Tabs.Navigator screenOptions={{ headerShown: false }}>
        <Tabs.Screen name="HomeTab" component={HomeStackNavigator} options={{ title: 'Home' }} />
        <Tabs.Screen name="CategoriesTab" component={CategoriesStackNavigator} options={{ title: 'Categories' }} />
        <Tabs.Screen name="SearchTab" component={SearchStackNavigator} options={{ title: 'Search' }} />
        <Tabs.Screen name="CartTab" component={CartStackNavigator} options={{ title: 'Cart' }} />
        <Tabs.Screen name="MoreTab" component={MoreStackNavigator} options={{ title: 'More' }} />
        <Tabs.Screen name="AccountTab" component={AccountStackNavigator} options={{ title: 'Account' }} />
      </Tabs.Navigator>
      <TaeboWidget />
    </View>
  );
}

function AuthStackNavigator() {
  return (
    <AuthStack.Navigator>
      <AuthStack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
      <AuthStack.Screen name="Register" component={RegisterScreen} options={{ title: 'Create account' }} />
      <AuthStack.Screen name="ForgotPassword" component={ForgotPasswordScreen} options={{ title: 'Forgot password' }} />
      <AuthStack.Screen name="ResetPassword" component={ResetPasswordScreen} options={{ title: 'Reset password' }} />
      <AuthStack.Screen name="VerifyDevice" component={VerifyDeviceScreen} options={{ title: 'Verify device' }} />
      <AuthStack.Screen name="VerifyEmail" component={VerifyEmailScreen} options={{ title: 'Verify email' }} />
    </AuthStack.Navigator>
  );
}

// AC-4 — the Admin path (AdminStack) is reachable only by deep link / a distinct entry point
// wired in App.tsx, never from CustomerTabs/AuthStackNavigator's own screens — customers never see
// an Admin navigation entry point in the app, matching the website's separation.
function AdminStackNavigator() {
  return (
    <AdminStack.Navigator>
      <AdminStack.Screen name="AdminLogin" component={AdminLoginScreen} options={{ headerShown: false }} />
      <AdminStack.Screen name="AdminTwoFactor" component={AdminTwoFactorScreen} options={{ title: 'Verify' }} />
      <AdminStack.Screen name="AdminDashboard" component={AdminDashboardScreen} options={{ headerShown: false }} />
    </AdminStack.Navigator>
  );
}

// AC-4 — the Admin path has no button/link anywhere in customer navigation (CustomerTabs,
// AuthStackNavigator). The only way an unauthenticated device reaches AdminLoginScreen is this
// deep link (czdigitizing://admin) — a distinct entry point admins are given directly, exactly
// like the website's separate /admin path is never linked from the customer site.
function useIsAdminDeepLink(): boolean {
  const [isAdminLink, setIsAdminLink] = useState(false);

  useEffect(() => {
    Linking.getInitialURL().then((url) => {
      if (url?.includes('admin')) setIsAdminLink(true);
    });
    const subscription = Linking.addEventListener('url', ({ url }) => {
      if (url.includes('admin')) setIsAdminLink(true);
    });
    return () => subscription.remove();
  }, []);

  return isAdminLink;
}

// AC-2 — session persists until logout/expiry; signed-out shows the auth stack, signed-in shows
// the customer tabs (or, for an admin account, the admin stack — never both nav surfaces at once).
export function RootNavigator() {
  const { user, isReady } = useAuth();
  const isAdminLink = useIsAdminDeepLink();

  if (!isReady) return null;
  if (user?.role === 'admin') return <AdminStackNavigator />;
  if (!user) return isAdminLink ? <AdminStackNavigator /> : <AuthStackNavigator />;
  return <CustomerTabs />;
}
