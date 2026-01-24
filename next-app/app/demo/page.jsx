'use client'
import IdentityClientMount from '../../components/IdentityClientMount'

export default function DemoPage(){
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-semibold">Identity Verification — Demo</h1>
      <p className="mt-2 text-sm text-gray-600">A simple demo using the legacy client scripts mounted inside Next.js. Useful for testing captures and local verification calls.</p>

      <div className="mt-4 border rounded p-3 bg-white">
        <IdentityClientMount />
      </div>

      <section className="mt-6 text-sm text-gray-700">
        <h2 className="font-medium">Notes</h2>
        <ul className="list-disc ml-6 mt-2">
          <li>Ensure `public/js` from the legacy app is copied to `next-app/public/js`.</li>
          <li>Use browser HTTPS for camera access in dev.</li>
        </ul>
      </section>
    </div>
  )
}
