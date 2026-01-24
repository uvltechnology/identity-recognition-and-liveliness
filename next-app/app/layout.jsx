import './globals.css'

export const metadata = {
  title: 'Identity Verification',
  description: 'Identity verification demo migrated to Next.js'
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  )
}
