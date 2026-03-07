import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { SessionProvider } from '@/lib/session-provider'

const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Kitui Housing Program',
  description: 'Explore and manage housing projects in Kitui County. Find information about completed, ongoing, and planned housing developments.',
  keywords: 'Kitui, Housing, Real Estate, Projects, Development',
  authors: [{ name: 'Kitui Housing Program' }],
  creator: 'Kitui Housing Program',
  publisher: 'Kitui Housing Program',
  robots: {
    index: true,
    follow: true,
    nocache: false,
  },
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 5,
    userScalable: true,
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://kitui-housing.com',
    title: 'Kitui Housing Program',
    description: 'Explore housing projects in Kitui County',
    siteName: 'Kitui Housing Program',
  },
}

export const viewport: Viewport = {
  themeColor: '#1a4d47',
  colorScheme: 'light',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      </head>
      <body className="bg-white text-foreground">
        <SessionProvider>
          {children}
        </SessionProvider>
      </body>
    </html>
  )
}
