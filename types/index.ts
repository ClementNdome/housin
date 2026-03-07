export interface Project {
  id?: number
  name: string
  boma_id: string
  lat: number
  lon: number
  status: 'completed' | 'ongoing' | 'nearing completion' | 'planned'
  units: number
  unit_types?: string
  price_start?: number
  price_range?: string
  description: string
  image?: string
  created_at?: string
  updated_at?: string
}

export interface User {
  id: number
  username: string
  email: string
  is_admin: boolean
  is_active: boolean
  created_at: string
}

export interface AuthUser extends User {
  token?: string
}

export interface AdminStats {
  total_users: number
  total_projects: number
  completed_projects: number
  ongoing_projects: number
  planned_projects: number
}

export interface ContactFormData {
  name: string
  email: string
  message: string
}

export interface LoginFormData {
  username: string
  password: string
}

export interface SignupFormData {
  username: string
  email: string
  password: string
  confirmPassword: string
}

export interface MapMarker {
  project: Project
  color: string
  position: [number, number]
}

export interface Favorite {
  id: string
  name: string
  project: Project
}
