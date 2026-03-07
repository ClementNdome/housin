import axios, { AxiosInstance, AxiosError } from 'axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

class APIClient {
  private client: AxiosInstance

  constructor() {
    this.client = axios.create({
      baseURL: API_URL,
      withCredentials: true, // Include cookies in requests
      headers: {
        'Content-Type': 'application/json',
      },
    })

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (error.response?.status === 401) {
          // Redirect to login on unauthorized
          window.location.href = '/auth/login'
        }
        return Promise.reject(error)
      }
    )
  }

  // Projects endpoints
  async getProjects() {
    try {
      const { data } = await this.client.get('/api/projects')
      return data
    } catch (error) {
      console.error('Error fetching projects:', error)
      throw error
    }
  }

  async getProject(id: string) {
    const { data } = await this.client.get(`/api/projects/${id}`)
    return data
  }

  // Auth endpoints
  async login(username: string, password: string) {
    const { data } = await this.client.post('/login', {
      username,
      password,
    })
    return data
  }

  async signup(username: string, email: string, password: string) {
    const { data } = await this.client.post('/signup', {
      username,
      email,
      password,
    })
    return data
  }

  async logout() {
    await this.client.post('/logout')
  }

  async getMe() {
    const { data } = await this.client.get('/api/me')
    return data
  }

  // Admin endpoints
  async getUsers() {
    const { data } = await this.client.get('/api/admin/users')
    return data
  }

  async createUser(userData: any) {
    const { data } = await this.client.post('/api/admin/users', userData)
    return data
  }

  async updateUser(id: number, userData: any) {
    const { data } = await this.client.put(`/api/admin/users/${id}`, userData)
    return data
  }

  async deleteUser(id: number) {
    await this.client.delete(`/api/admin/users/${id}`)
  }

  async getAdminStats() {
    const { data } = await this.client.get('/api/admin/stats')
    return data
  }

  // Contact form
  async submitContact(contactData: any) {
    const { data } = await this.client.post('/contact', contactData)
    return data
  }

  // Password reset
  async resetPassword(email: string) {
    const { data } = await this.client.post('/forgot-password', { email })
    return data
  }

  async confirmReset(token: string, password: string) {
    const { data } = await this.client.post(`/reset-password/${token}`, {
      password,
    })
    return data
  }
}

export const apiClient = new APIClient()
