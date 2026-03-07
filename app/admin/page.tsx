'use client'

import { useEffect, useState } from 'react'
import { Header } from '@/components/header'
import { Footer } from '@/components/footer'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { apiClient } from '@/lib/api-client'
import { cn } from '@/lib/utils'
import { User, Project, AdminStats } from '@/types'
import { Edit, Trash2, Plus, X } from 'lucide-react'

type TabType = 'overview' | 'users' | 'projects'

interface FormState {
  isOpen: boolean
  type: 'user' | 'project'
  isEdit: boolean
  data: any
}

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState<TabType>('overview')
  const [users, setUsers] = useState<User[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [formState, setFormState] = useState<FormState>({
    isOpen: false,
    type: 'user',
    isEdit: false,
    data: {},
  })

  // Load data
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true)
        const [usersData, projectsData, statsData] = await Promise.all([
          apiClient.getUsers(),
          apiClient.getProjects(),
          apiClient.getAdminStats(),
        ])
        setUsers(usersData)
        setProjects(projectsData)
        setStats(statsData)
        setError(null)
        console.log('[v0] Admin data loaded')
      } catch (err) {
        console.error('[v0] Error loading admin data:', err)
        setError('Failed to load admin data. Please refresh the page.')
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [])

  const handleOpenForm = (type: 'user' | 'project', data?: any) => {
    setFormState({
      isOpen: true,
      type,
      isEdit: !!data,
      data: data || {},
    })
  }

  const handleCloseForm = () => {
    setFormState({
      isOpen: false,
      type: 'user',
      isEdit: false,
      data: {},
    })
  }

  const handleDelete = async (type: 'user' | 'project', id: number) => {
    if (!confirm(`Are you sure you want to delete this ${type}?`)) return

    try {
      if (type === 'user') {
        await apiClient.deleteUser(id)
        setUsers(users.filter(u => u.id !== id))
      } else {
        // Delete project logic would go here
      }
    } catch (err) {
      console.error('[v0] Error deleting item:', err)
      setError('Failed to delete item')
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin mb-3">
            <div className="w-8 h-8 border-4 border-gray-300 border-t-primary rounded-full"></div>
          </div>
          <p className="text-gray-600">Loading admin panel...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen bg-white">
      <Header />

      <main className="flex-1">
        {/* Admin Header */}
        <section className="bg-gradient-to-r from-primary to-primary-dark text-white py-8 px-4 md:px-6">
          <div className="max-w-7xl mx-auto">
            <h1 className="text-3xl md:text-4xl font-bold mb-2">Admin Dashboard</h1>
            <p className="text-white/90">Manage users, projects, and system settings</p>
          </div>
        </section>

        {/* Error Alert */}
        {error && (
          <div className="mx-4 md:mx-6 mt-4 bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
            {error}
            <button
              onClick={() => setError(null)}
              className="float-right text-red-600 hover:text-red-900"
            >
              ✕
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-6">
          <div className="border-b border-gray-200 mb-6">
            <div className="flex gap-4">
              {['overview', 'users', 'projects'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab as TabType)}
                  className={cn(
                    'px-4 py-3 font-medium text-sm border-b-2 transition-colors',
                    activeTab === tab
                      ? 'border-primary text-primary'
                      : 'border-transparent text-gray-600 hover:text-primary'
                  )}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { label: 'Total Users', value: stats?.total_users || 0 },
                { label: 'Total Projects', value: stats?.total_projects || 0 },
                { label: 'Completed', value: stats?.completed_projects || 0 },
                { label: 'Ongoing', value: stats?.ongoing_projects || 0 },
              ].map(({ label, value }) => (
                <Card key={label}>
                  <CardContent className="p-6">
                    <p className="text-gray-600 text-sm font-medium mb-2">{label}</p>
                    <p className="text-4xl font-bold text-primary">{value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Users Tab */}
          {activeTab === 'users' && (
            <div>
              <div className="mb-6">
                <Button variant="primary" onClick={() => handleOpenForm('user')}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add User
                </Button>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Users</CardTitle>
                </CardHeader>
                <CardContent>
                  {users.length === 0 ? (
                    <p className="text-gray-600 text-center py-8">No users found</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="border-b border-gray-200">
                          <tr>
                            <th className="text-left py-3 px-4 font-semibold">Username</th>
                            <th className="text-left py-3 px-4 font-semibold">Email</th>
                            <th className="text-left py-3 px-4 font-semibold">Status</th>
                            <th className="text-left py-3 px-4 font-semibold">Role</th>
                            <th className="text-right py-3 px-4 font-semibold">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {users.map(user => (
                            <tr key={user.id} className="border-b border-gray-200 hover:bg-gray-50">
                              <td className="py-3 px-4 font-medium">{user.username}</td>
                              <td className="py-3 px-4">{user.email}</td>
                              <td className="py-3 px-4">
                                <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                  user.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                }`}>
                                  {user.is_active ? 'Active' : 'Inactive'}
                                </span>
                              </td>
                              <td className="py-3 px-4">
                                <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                  user.is_admin ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'
                                }`}>
                                  {user.is_admin ? 'Admin' : 'User'}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-right flex gap-2 justify-end">
                                <button
                                  onClick={() => handleOpenForm('user', user)}
                                  className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                                  aria-label="Edit user"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDelete('user', user.id)}
                                  className="p-2 hover:bg-red-100 rounded-lg transition-colors text-red-600"
                                  aria-label="Delete user"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Projects Tab */}
          {activeTab === 'projects' && (
            <div>
              <div className="mb-6">
                <Button variant="primary" onClick={() => handleOpenForm('project')}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Project
                </Button>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Projects</CardTitle>
                </CardHeader>
                <CardContent>
                  {projects.length === 0 ? (
                    <p className="text-gray-600 text-center py-8">No projects found</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="border-b border-gray-200">
                          <tr>
                            <th className="text-left py-3 px-4 font-semibold">Name</th>
                            <th className="text-left py-3 px-4 font-semibold">Boma ID</th>
                            <th className="text-left py-3 px-4 font-semibold">Status</th>
                            <th className="text-left py-3 px-4 font-semibold">Units</th>
                            <th className="text-right py-3 px-4 font-semibold">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {projects.map(project => (
                            <tr key={project.boma_id} className="border-b border-gray-200 hover:bg-gray-50">
                              <td className="py-3 px-4 font-medium truncate">{project.name}</td>
                              <td className="py-3 px-4">{project.boma_id}</td>
                              <td className="py-3 px-4">
                                <span className="px-2 py-1 rounded text-xs font-semibold bg-blue-100 text-blue-800">
                                  {project.status}
                                </span>
                              </td>
                              <td className="py-3 px-4">{project.units}</td>
                              <td className="py-3 px-4 text-right flex gap-2 justify-end">
                                <button
                                  onClick={() => handleOpenForm('project', project)}
                                  className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                                  aria-label="Edit project"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDelete('project', project.id || 0)}
                                  className="p-2 hover:bg-red-100 rounded-lg transition-colors text-red-600"
                                  aria-label="Delete project"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </main>

      <Footer />

      {/* Form Modal */}
      {formState.isOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>
                {formState.isEdit ? `Edit ${formState.type}` : `Add ${formState.type}`}
              </CardTitle>
              <button
                onClick={handleCloseForm}
                className="p-1 hover:bg-gray-100 rounded-lg"
                aria-label="Close form"
              >
                <X className="w-5 h-5" />
              </button>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 text-sm">
                Form content would go here. This is a placeholder for the form modal.
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
