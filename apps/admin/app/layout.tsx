import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/lib/auth-context';
import { NotificationBell } from '@/components/NotificationBell';
import { Logo } from '@/components/Logo';

// docs/specs/2026-09-02-01-brand-visual-identity.md AC-4 — same font token as apps/web.
const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'CZ Digitizing — Admin',
  description: 'Protected admin portal for CZ Digitizing.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-brand-navy font-sans text-brand-silver antialiased">
        <AuthProvider>
          <header className="flex items-center justify-between border-b border-brand-silver/10 bg-brand-navyLight px-6 py-4">
            <Logo variant="dark" />
            <NotificationBell />
          </header>
          <main className="p-6">{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}
