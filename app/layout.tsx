// app/layout.tsx
import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'tabi — AI 订票助手',
  description: '说说你想去哪，tabi 帮你搞定机票和酒店',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh">
      <body className="antialiased">{children}</body>
    </html>
  )
}
