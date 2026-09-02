import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/lib/auth-context';
import { Header } from '@/components/Header';

// docs/specs/2026-09-02-01-brand-visual-identity.md AC-4 — one consistent font family loaded via
// next/font (self-hosted, no runtime <link>/layout-shift), not the default system-font stack.
const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'CZ Digitizing',
  description: 'Embroidery designs, digitizing services, and custom design requests.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-brand-lightGray font-sans text-brand-navy antialiased">
        <AuthProvider>
          <Header />
          <main className="p-6">{children}</main>
          <footer className="border-t border-gray-200 px-6 py-4 text-sm text-gray-500">
            &copy; {new Date().getFullYear()} CZ Digitizing
          </footer>
        </AuthProvider>
      </body>
    </html>
  );
}
