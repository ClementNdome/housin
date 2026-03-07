'use client'

import { useEffect, useState } from 'react'
import { Header } from '@/components/header'
import { Footer } from '@/components/footer'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { apiClient } from '@/lib/api-client'
import { Project, AdminStats } from '@/types'

export default function StatsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadData = async () => {
      try {
        const projectsData = await apiClient.getProjects()
        setProjects(projectsData)

        // Calculate statistics
        const totalProjects = projectsData.length
        const completed = projectsData.filter((p: Project) => p.status === 'completed' || p.status === 'complete').length
        const ongoing = projectsData.filter((p: Project) => p.status === 'ongoing').length
        const nearing = projectsData.filter((p: Project) => p.status === 'nearing completion').length
        const planned = projectsData.filter((p: Project) => p.status === 'planned').length
        const totalUnits = projectsData.reduce((sum: number, p: Project) => sum + p.units, 0)

        setStats({
          total_users: 0, // Would come from admin API
          total_projects: totalProjects,
          completed_projects: completed,
          ongoing_projects: ongoing,
          planned_projects: planned,
        })

        setError(null)
      } catch (err) {
        console.error('[v0] Error loading stats:', err)
        setError('Failed to load statistics')
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [])

  const totalUnits = projects.reduce((sum, p) => sum + p.units, 0)
  const avgUnits = projects.length > 0 ? Math.round(totalUnits / projects.length) : 0

  return (
    <div className="flex flex-col min-h-screen bg-white">
      <Header />

      <main className="flex-1">
        {/* Hero */}
        <section className="bg-primary text-white py-12 md:py-16 px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-4 text-balance">Kitui Housing Statistics</h1>
            <p className="text-lg text-white/90">
              Comprehensive statistics and insights about housing developments across Kitui County
            </p>
          </div>
        </section>

        {/* Stats Content */}
        <section className="py-12 md:py-20 px-4 md:px-6">
          <div className="max-w-6xl mx-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <div className="animate-spin mb-3">
                    <div className="w-8 h-8 border-4 border-gray-300 border-t-primary rounded-full"></div>
                  </div>
                  <p className="text-gray-600">Loading statistics...</p>
                </div>
              </div>
            ) : error ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
                {error}
              </div>
            ) : (
              <>
                {/* Key Stats */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                  <Card>
                    <CardContent className="p-6">
                      <p className="text-gray-600 text-sm font-medium mb-2">Total Projects</p>
                      <p className="text-4xl font-bold text-primary">{stats?.total_projects || 0}</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-6">
                      <p className="text-gray-600 text-sm font-medium mb-2">Total Units</p>
                      <p className="text-4xl font-bold text-status-ongoing">{totalUnits.toLocaleString()}</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-6">
                      <p className="text-gray-600 text-sm font-medium mb-2">Average Units/Project</p>
                      <p className="text-4xl font-bold text-status-nearing">{avgUnits}</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-6">
                      <p className="text-gray-600 text-sm font-medium mb-2">Project Density</p>
                      <p className="text-4xl font-bold text-status-completed">{projects.length}</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Project Status Breakdown */}
                <Card className="mb-12">
                  <CardHeader>
                    <CardTitle>Project Status Breakdown</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                      <div className="text-center">
                        <div className="w-24 h-24 rounded-full bg-status-completed/10 flex items-center justify-center mx-auto mb-3">
                          <span className="text-2xl font-bold text-status-completed">
                            {stats?.completed_projects || 0}
                          </span>
                        </div>
                        <p className="font-medium text-foreground">Completed</p>
                        <p className="text-sm text-gray-600">
                          {stats && stats.total_projects > 0
                            ? Math.round(((stats.completed_projects || 0) / stats.total_projects) * 100)
                            : 0}%
                        </p>
                      </div>

                      <div className="text-center">
                        <div className="w-24 h-24 rounded-full bg-status-ongoing/10 flex items-center justify-center mx-auto mb-3">
                          <span className="text-2xl font-bold text-status-ongoing">
                            {stats?.ongoing_projects || 0}
                          </span>
                        </div>
                        <p className="font-medium text-foreground">Ongoing</p>
                        <p className="text-sm text-gray-600">
                          {stats && stats.total_projects > 0
                            ? Math.round(((stats.ongoing_projects || 0) / stats.total_projects) * 100)
                            : 0}%
                        </p>
                      </div>

                      <div className="text-center">
                        <div className="w-24 h-24 rounded-full bg-status-nearing/10 flex items-center justify-center mx-auto mb-3">
                          <span className="text-2xl font-bold text-status-nearing">
                            {projects.filter(p => p.status === 'nearing completion').length}
                          </span>
                        </div>
                        <p className="font-medium text-foreground">Nearing Completion</p>
                        <p className="text-sm text-gray-600">
                          {stats && stats.total_projects > 0
                            ? Math.round((projects.filter(p => p.status === 'nearing completion').length / stats.total_projects) * 100)
                            : 0}%
                        </p>
                      </div>

                      <div className="text-center">
                        <div className="w-24 h-24 rounded-full bg-status-planned/10 flex items-center justify-center mx-auto mb-3">
                          <span className="text-2xl font-bold text-status-planned">
                            {stats?.planned_projects || 0}
                          </span>
                        </div>
                        <p className="font-medium text-foreground">Planned</p>
                        <p className="text-sm text-gray-600">
                          {stats && stats.total_projects > 0
                            ? Math.round(((stats.planned_projects || 0) / stats.total_projects) * 100)
                            : 0}%
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Top Projects */}
                <Card>
                  <CardHeader>
                    <CardTitle>Largest Projects by Units</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {projects
                        .sort((a, b) => b.units - a.units)
                        .slice(0, 10)
                        .map((project, idx) => (
                          <div key={project.boma_id} className="flex items-center gap-4 pb-4 border-b border-gray-200 last:border-0">
                            <span className="text-lg font-bold text-primary">{idx + 1}</span>
                            <div className="flex-1">
                              <p className="font-medium text-foreground">{project.name}</p>
                              <p className="text-sm text-gray-600">{project.boma_id}</p>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-lg">{project.units}</p>
                              <p className="text-xs text-gray-600">units</p>
                            </div>
                          </div>
                        ))}
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
