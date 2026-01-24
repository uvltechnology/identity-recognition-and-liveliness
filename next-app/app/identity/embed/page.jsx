'use client'
import IdentityClientMount from '../../../components/IdentityClientMount'

export default function EmbedPage(){
  return (
    <div className="p-3">
      <h3 className="text-lg font-medium">Identity Verification (Embed)</h3>
      <div className="mt-3">
        <IdentityClientMount embedMode />
      </div>
    </div>
  )
}
