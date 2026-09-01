import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/lib/auth-context';

export const metadata: Metadata = {
  title: 'CZ Digitizing',
  description: 'Embroidery designs, digitizing services, and custom design requests.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-gray-900 antialiased">
        <AuthProvider>
          <header className="border-b border-gray-200 px-6 py-4">
            <span className="font-semibold">CZ Digitizing</span>
          </header>
          <main className="p-6">{children}</main>
          <footer className="border-t border-gray-200 px-6 py-4 text-sm text-gray-500">
            &copy; {new Date().getFullYear()} CZ Digitizing
          </footer>
        </AuthProvider>
      </body>
    </html>
  );
}
