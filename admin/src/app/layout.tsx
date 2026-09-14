import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { Toaster } from 'sonner';
import { cn } from '@/lib/cn';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const jetbrains = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains', display: 'swap' });

export const metadata: Metadata = {
  title: { template: '%s · Qui est-ce ? Admin', default: 'Qui est-ce ? Admin' },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: '#08090a',
  colorScheme: 'dark',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={cn(inter.variable, jetbrains.variable)}>
      <body className="bg-bg font-sans text-sm text-fg antialiased">
        {children}
        <Toaster
          theme="dark"
          position="bottom-right"
          toastOptions={{
            className: '!bg-elevated !border-line-strong !text-fg !text-sm !font-sans',
          }}
        />
      </body>
    </html>
  );
}
