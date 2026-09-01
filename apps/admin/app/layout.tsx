import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/lib/auth-context';

export const metadata: Metadata = {
  title: 'CZ Digitizing — Admin',
  description: 'Protected admin portal for CZ Digitizing.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-950 text-gray-100 antialiased">
        <AuthProvider>
          <header className="border-b border-gray-800 px-6 py-4">
            <span className="font-semibold">CZ Digitizing — Admin</span>
          </header>
          <main className="p-6">{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}
