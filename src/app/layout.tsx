import type { Metadata, Viewport } from 'next';
import '../index.css';
import { THEME_STORAGE_KEY } from '../lib/theme';
import { ThemeProvider } from '../context/ThemeContext';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.PUBLIC_SITE_URL || 'http://localhost:3000'),
  title: {
    default: 'The Bhikitia Encyclopedia',
    template: '%s — The Bhikitia Encyclopedia',
  },
  description: 'The Bhikitia Encyclopedia explores people, places, ideas, and events from around the world.',
  openGraph: {
    title: 'The Bhikitia Encyclopedia',
    description: 'Explore people, places, ideas, and events from around the world.',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'The Bhikitia Encyclopedia',
    description: 'Explore people, places, ideas, and events from around the world.',
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f6f5f2' },
    { media: '(prefers-color-scheme: dark)', color: '#080d18' },
  ],
};

// Applies the stored reading theme before first paint so dark mode never flashes.
const themeBootstrap = `(function(){try{var s=localStorage.getItem('${THEME_STORAGE_KEY}');var dark=s?s==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;if(dark){document.documentElement.classList.add('dark');}}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-canvas text-ink antialiased">
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
