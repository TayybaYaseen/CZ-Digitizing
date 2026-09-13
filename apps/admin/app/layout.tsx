import type { Metadata } from 'next';
import { Montserrat, Playfair_Display } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/lib/auth-context';
import { AppShell } from '@/components/AppShell';

// Brand kit fonts per docs/CZ Digitizing Admin Panel.html's design tokens (Playfair Display for
// headings, Montserrat for body) — supersedes the interim Inter-only choice used before this
// reference existed (docs/specs/2026-09-02-01-brand-visual-identity.md AC-4).
const playfair = Playfair_Display({ subsets: ['latin'], variable: '--font-playfair' });
const montserrat = Montserrat({ subsets: ['latin'], variable: '--font-montserrat' });

export const metadata: Metadata = {
  title: 'CZ Digitizing — Admin',
  description: 'Protected admin portal for CZ Digitizing.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${playfair.variable} ${montserrat.variable}`}>
      <body className="h-screen overflow-hidden bg-gray-100 font-sans text-gray-700 antialiased">
        <AuthProvider>
          <AppShell>{children}</AppShell>
        </AuthProvider>
      </body>
    </html>
  );
}
