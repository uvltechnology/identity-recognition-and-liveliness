'use client'
import IdentityClientMount from '../../components/IdentityClientMount'

export default function IdentityPage(){
  return (
    <div className="p-4 max-w-5xl mx-auto">
      <h2 className="text-xl font-medium">Identity Verification - Test UI</h2>
      <p className="text-sm text-gray-600">This page mounts the original client scripts and DOM nodes used by the legacy demo.</p>
      <div className="mt-4">
        <IdentityClientMount />
      </div>
    </div>
  )
}
