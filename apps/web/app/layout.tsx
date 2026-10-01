import type { Metadata } from 'next';
import { Montserrat, Playfair_Display } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/lib/auth-context';
import { CartProvider } from '@/lib/cart-context';
import { LocaleProvider } from '@/lib/locale-context';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { TaeboWidget } from '@/components/TaeboWidget';
import { localeDir } from '@/i18n/config';
import { getFlatMessages, getRequestLocale, getServerTranslator } from '@/i18n/server';

// docs/specs/2026-09-02-01-brand-visual-identity.md AC-4 — brand kit fonts (Playfair Display for
// headings, Montserrat for body), loaded via next/font (self-hosted, no runtime <link>/layout-shift)
// same as apps/admin/app/layout.tsx. Supersedes the interim Inter-only choice: apps/web's components
// already reference `font-display` throughout (Hero.tsx and others) but this app never loaded
// Playfair or defined that Tailwind token, so those headings were silently falling back to the
// default sans stack — see tailwind.config.ts's own fix in this same change.
const playfair = Playfair_Display({ subsets: ['latin'], variable: '--font-playfair' });
const montserrat = Montserrat({ subsets: ['latin'], variable: '--font-montserrat' });

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerTranslator();
  return {
    title: 'CZ Digitizing',
    description: t('meta.siteDescription'),
  };
}

// docs/specs/2026-08-28-16-internationalization.md AC-1/AC-4/AC-7 — the locale comes from the
// `czd_locale` cookie on the server, so lang/dir and every translated string are already correct in
// the first HTML response (no English flash, no hydration mismatch, no post-load RTL flip).
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { locale, fromCookie } = getRequestLocale();
  const messages = await getFlatMessages(locale);

  return (
    <html lang={locale} dir={localeDir(locale)} className={`${playfair.variable} ${montserrat.variable}`}>
      <body className="min-h-screen bg-brand-lightGray font-sans text-brand-navy antialiased">
        <AuthProvider>
          <LocaleProvider initialLocale={locale} initialMessages={messages} hasExplicitChoice={fromCookie}>
            <CartProvider>
              <Header />
              <main className="p-6">{children}</main>
              <Footer />
              <TaeboWidget />
            </CartProvider>
          </LocaleProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
