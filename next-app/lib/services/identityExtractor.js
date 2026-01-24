// Ported identity extraction heuristics from server implementation

function titleCase(s){
  if(!s) return s
  return s.replace(/\b([A-Za-z])([A-Za-z]*)\b/g, (_, a, b) => a.toUpperCase() + b.toLowerCase())
}

function parseMrz(text){
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  const mrz = lines.filter(l => /^[A-Z0-9<]{25,}$/.test(l))
  if (mrz.length < 2) return null

  const joined = mrz.join('\n')
  const birth = joined.match(/\D(\d{6})\D/)
  const birthYYMMDD = birth ? birth[1] : null

  const nameLine = mrz.find(l => l.includes('<<'))
  let lastName, firstName
  if (nameLine) {
    const parts = nameLine.replace(/<+/g, ' ').trim().split(' ').filter(Boolean)
    if (parts.length >= 2) {
      lastName = parts[0]
      firstName = parts.slice(1).join(' ')
    }
  }

  let birthDate
  if (birthYYMMDD) {
    const yy = parseInt(birthYYMMDD.slice(0,2), 10)
    const mm = birthYYMMDD.slice(2,4)
    const dd = birthYYMMDD.slice(4,6)
    const year = yy >= 0 && yy <= 30 ? 2000 + yy : 1900 + yy
    birthDate = `${year}-${mm}-${dd}`
  }

  return {
    firstName: firstName ? titleCase(firstName) : undefined,
    lastName: lastName ? titleCase(lastName) : undefined,
    birthDate
  }
}

function pickIdNumber(text, idType = 'generic'){
  const lines = text.split(/\r?\n/)
  const candidates = []
  const rx = /\b(?:PCN|CRN|ID(?:\s*No)?|Identity|National|Citizen|Document|Doc|No|Number|NIN|NIC)[\s:\-]*([A-Z0-9\-]{5,})\b/i
  for (const line of lines){
    const m = line.replace(/\s+/g, ' ').match(rx)
    if (m) candidates.push(m[1])
  }
  if (idType === 'national-id'){
    const pcn = lines.map(l => l.trim()).find(l => /\bPCN\b/i.test(l))
    if (pcn){
      const m = pcn.match(/PCN[\s:\-]*([A-Z0-9\-]{5,})/i)
      if (m) return m[1].replace(/\s+/g, '').replace(/-/g, '')
    }
    const crn = lines.map(l => l.trim()).find(l => /\bCRN\b/i.test(l))
    if (crn){
      const m = crn.match(/CRN[\s:\-]*([A-Z0-9\-]{5,})/i)
      if (m) return m[1].replace(/\s+/g, '').replace(/-/g, '')
    }
  }
  if (candidates.length === 0){
    const tokens = text.match(/[A-Z0-9\-]{6,}/gi) || []
    const withDigits = tokens.filter(t => /\d/.test(t))
    withDigits.sort((a,b)=>b.length - a.length)
    if (withDigits[0]) candidates.push(withDigits[0])
  }
  return candidates[0] ? candidates[0].replace(/\s+/g, '').replace(/-/g, '') : undefined
}

function pickBirthDate(text){
  const patterns = [
    /\b(20\d{2}|19\d{2})[-/.](0[1-9]|1[0-2])[-/.](0[1-9]|[12]\d|3[01])\b/,
    /\b(0[1-9]|[12]\d|3[01])[\/\.](0[1-9]|1[0-2])[\/\.](19|20)\d{2}\b/,
    /\b(0[1-9]|1[0-2])[\/\.](0[1-9]|[12]\d|3[01])[\/\.](19|20)\d{2}\b/,
    /\b(0[1-9]|[12]\d|3[01])\s+([A-Za-z]{3,})\s+(19|20)\d{2}\b/
  ]
  for (const rx of patterns){
    const m = text.match(rx)
    if (m) return m[0].replace(/\s+/g, ' ')
  }
  return undefined
}

function pickNames(text){
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  let firstName, lastName
  for (const line of lines){
    const l = line.toLowerCase()
    if (!firstName && /(given|first)\s*name/.test(l)){
      firstName = titleCase(line.replace(/.*?:/, '').trim())
    }
    if (!lastName && /(surname|last)\s*name/.test(l)){
      lastName = titleCase(line.replace(/.*?:/, '').trim())
    }
    if (firstName && lastName) break
  }
  if (!(firstName && lastName)){
    const m = text.match(/\bname\b[:\s\-]*([A-Z ,.'\-]{4,})/i)
    if (m){
      const raw = m[1].trim()
      if (raw.includes(',')){
        const [last, rest] = raw.split(',',2)
        lastName = lastName || titleCase(last.trim())
        firstName = firstName || titleCase(rest.trim().split(/\s+/)[0])
      } else {
        const parts = raw.split(/\s+/)
        if (parts.length >= 2){
          firstName = firstName || titleCase(parts[0])
          lastName = lastName || titleCase(parts.slice(1).join(' '))
        }
      }
    }
  }
  return { firstName, lastName }
}

export async function extractIdentity(ocrResult, { idType = 'national-id' } = {}){
  if(!ocrResult) return { error: 'missing ocrResult' }
  const text = (ocrResult.text || (ocrResult.basicText && ocrResult.basicText.text) || (ocrResult.structuredText && ocrResult.structuredText.text) || '').replace(/\u0000/g, ' ').trim()

  const mrz = parseMrz(text)
  let firstName = mrz?.firstName
  let lastName = mrz?.lastName
  let birthDate = mrz?.birthDate

  const names = pickNames(text)
  firstName = firstName || names.firstName
  lastName = lastName || names.lastName
  birthDate = birthDate || pickBirthDate(text)
  const idNumber = pickIdNumber(text, idType)

  return { firstName, lastName, birthDate, idNumber, source: 'heuristic', rawText: text }
}

export default { extractIdentity }
