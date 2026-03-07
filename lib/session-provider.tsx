'use client'

import { ReactNode } from 'react'

export function SessionProvider({ children }: { children: ReactNode }) {
  // NextAuth will be integrated here in the authentication task
  // For now, this is a placeholder that allows children to render
  return <>{children}</>
}
