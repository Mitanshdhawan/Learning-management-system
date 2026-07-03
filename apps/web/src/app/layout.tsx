import type { Metadata } from 'next'
import { AuthProvider } from '@/components/auth-provider'
import { ThemeProvider } from '@/components/theme-provider'
import { themeScript } from '@/lib/theme-script'
import './globals.css'

export const metadata: Metadata = {
  title: 'TOP LMS',
  description: 'Internal learning management system',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen antialiased">
        <ThemeProvider>
          <AuthProvider>{children}</AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
