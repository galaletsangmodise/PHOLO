import type { Metadata } from 'next';
import { Atkinson_Hyperlegible } from 'next/font/google';
import type { ReactNode } from 'react';
import { Providers } from '@/components/Providers';
import './globals.css';

const atkinson = Atkinson_Hyperlegible({
  weight: ['400', '700'],
  subsets: ['latin'],
  variable: '--font-atkinson',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Pholo CMS',
  description: 'Clinic Management System',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-ZA" className={atkinson.variable}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
