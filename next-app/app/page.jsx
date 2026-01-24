import Link from 'next/link'

export default function Home() {
  return (
    <main className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-semibold">Identity Verification (Next.js)</h1>
      <p className="mt-2 text-sm text-gray-600">App Router scaffold. Use the identity pages for testing, embeds, docs and demo.</p>

      <div className="mt-6 space-x-3">
        <Link href="/identity" className="px-4 py-2 bg-blue-600 text-white rounded">Open Identity UI</Link>
        <Link href="/identity/embed" className="px-4 py-2 bg-gray-600 text-white rounded">Open Embed (iframe)</Link>
        <Link href="/docs" className="px-4 py-2 bg-green-600 text-white rounded">Documentation</Link>
        <Link href="/demo" className="px-4 py-2 bg-indigo-600 text-white rounded">Demo / Example</Link>
      </div>
    </main>
  )
}
