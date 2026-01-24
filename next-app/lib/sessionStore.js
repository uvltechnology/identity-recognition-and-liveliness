const sessions = new Map()

export function createSession(data){
  const id = 's_' + Date.now()
  sessions.set(id, { id, ...data, status: 'created', createdAt: Date.now() })
  return sessions.get(id)
}

export function getSession(id){
  return sessions.get(id)
}

export function updateSession(id, patch){
  const s = sessions.get(id)
  if(!s) return null
  Object.assign(s, patch)
  return s
}
