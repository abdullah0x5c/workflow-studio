import '@xyflow/react/dist/style.css'
import './globals.css'

export const metadata = {
  title: 'Workflow Studio',
  description:
    'A basic n8n-style workflow creator: add nodes, write their JavaScript, run the graph and watch data flow live.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-zinc-950 text-zinc-100 antialiased">
        {children}
      </body>
    </html>
  )
}
