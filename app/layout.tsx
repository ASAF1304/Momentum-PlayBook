import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/lib/auth-context';
import { ThemeProvider } from '@/lib/theme-context';
import { ErrorBoundary } from '@/components/error-boundary';
import { TrialBanner } from '@/components/trial-banner';
import { LegalFooter } from '@/components/legal-footer';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-jetbrains-mono',
  subsets: ['latin'],
  display: 'swap',
});

const siteUrl = 'https://momentumplaybook.com';

export const metadata: Metadata = {
  title: 'Momentum Playbook — Stage 2 Trading Journal',
  description: 'Track your trades with Minervini\'s Trend Template. Position sizing, journal, equity curve, and daily Stage 2 leaders — all in one place.',
  metadataBase: new URL(siteUrl),
  openGraph: {
    type: 'website',
    url: siteUrl,
    siteName: 'Momentum Playbook',
    title: 'Momentum Playbook — Stage 2 Trading Journal',
    description: 'Track your trades with Minervini\'s Trend Template. Position sizing, journal, equity curve, and daily Stage 2 leaders — all in one place.',
    images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: 'Momentum Playbook' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Momentum Playbook — Stage 2 Trading Journal',
    description: 'Track your trades with Minervini\'s Trend Template. Position sizing, journal, equity curve, and daily Stage 2 leaders.',
    images: ['/opengraph-image'],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}>
      <head>
        {/* Anti-flash: runs synchronously before React hydrates. suppressHydrationWarning
            on <html> tells React to accept the intentional data-theme mismatch. */}
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var s=localStorage.getItem('theme');var eff=s==='light'?'light':s==='dark'?'dark':window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.documentElement.setAttribute('data-theme',eff);}catch(e){}})();` }} />
      </head>
      <body className="min-h-full flex flex-col bg-[var(--bg-primary)]">
        <ErrorBoundary>
          <ThemeProvider>
            <AuthProvider>
              <TrialBanner />
              {children}
              <LegalFooter />
            </AuthProvider>
          </ThemeProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
