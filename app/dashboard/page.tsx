'use client'

import { useEffect, useState, useCallback } from 'react'
import { Header } from '@/components/header'
import { Footer } from '@/components/footer'
import { MapComponent } from '@/components/map-component'
import { Project, Favorite } from '@/types'
import { apiClient } from '@/lib/api-client'
import { cn } from '@/lib/utils'
import { Heart, X, MapPin, Home } from 'lucide-react'

export default function Dashboard() {
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [favorites, setFavorites] = useState<Favorite[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Load projects
  useEffect(() => {
    const loadProjects = async () => {
      try {
        setIsLoading(true)
        const data = await apiClient.getProjects()
        setProjects(data)
        setError(null)
        console.log('[v0] Projects loaded:', data.length)
      } catch (err) {
        console.error('[v0] Error loading projects:', err)
        setError('Failed to load projects. Please try again.')
      } finally {
        setIsLoading(false)
      }
    }

    loadProjects()
  }, [])

  // Filtered projects based on search
  const filteredProjects = projects.filter(project =>
    project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    project.boma_id.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Toggle favorite
  const toggleFavorite = useCallback((project: Project) => {
    const favId = `${project.boma_id}-${project.name}`
    setFavorites(prev => {
      const exists = prev.some(f => f.id === favId)
      if (exists) {
        return prev.filter(f => f.id !== favId)
      } else {
        return [...prev, { id: favId, name: project.name, project }]
      }
    })
  }, [])

  // Check if project is favorite
  const isFavorite = useCallback((project: Project) => {
    return favorites.some(f => f.id === `${project.boma_id}-${project.name}`)
  }, [favorites])

  // Status color map
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
      case 'complete':
        return 'bg-status-completed text-white'
      case 'ongoing':
        return 'bg-status-ongoing text-white'
      case 'nearing completion':
        return 'bg-status-nearing text-gray-900'
      case 'planned':
        return 'bg-status-planned text-white'
      default:
        return 'bg-gray-500 text-white'
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-white">
      <Header />

      <main className="flex flex-1 overflow-hidden">
        {/* Sidebar - Desktop */}
        <div className={cn(
          'w-full md:w-80 border-r border-gray-200 bg-gray-50 overflow-y-auto transition-all duration-300 flex flex-col',
          'fixed md:static inset-0 md:inset-auto z-40 md:z-auto',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        )}>
          {/* Sidebar Header */}
          <div className="p-4 border-b border-gray-200 bg-white flex items-center justify-between md:justify-start gap-3">
            <div className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-primary" />
              <h2 className="font-bold text-lg">Search Projects</h2>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="md:hidden p-1 hover:bg-gray-100 rounded-lg"
              aria-label="Close sidebar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Search Form */}
            <div>
              <input
                type="text"
                placeholder="Search by name or Boma ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                aria-label="Search projects"
              />
            </div>

            {/* Project Details or Default Message */}
            {selectedProject ? (
              <div className="border border-gray-200 rounded-lg p-4 bg-white">
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-bold text-lg text-foreground">{selectedProject.name}</h3>
                  <button
                    onClick={() => toggleFavorite(selectedProject)}
                    className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                    aria-label={isFavorite(selectedProject) ? 'Remove from favorites' : 'Add to favorites'}
                  >
                    <Heart
                      className={cn(
                        'w-5 h-5',
                        isFavorite(selectedProject)
                          ? 'fill-danger text-danger'
                          : 'text-gray-400'
                      )}
                    />
                  </button>
                </div>

                <div className="space-y-3 text-sm">
                  <div>
                    <span className={cn('inline-block px-2 py-1 rounded text-xs font-semibold capitalize', getStatusColor(selectedProject.status))}>
                      {selectedProject.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-gray-600 text-xs font-medium">Units</p>
                      <p className="font-semibold">{selectedProject.units}</p>
                    </div>
                    <div>
                      <p className="text-gray-600 text-xs font-medium">Boma ID</p>
                      <p className="font-semibold">{selectedProject.boma_id}</p>
                    </div>
                  </div>

                  {selectedProject.price_start && (
                    <div>
                      <p className="text-gray-600 text-xs font-medium">Starting Price</p>
                      <p className="font-semibold">KES {selectedProject.price_start.toLocaleString()}</p>
                    </div>
                  )}

                  {selectedProject.unit_types && (
                    <div>
                      <p className="text-gray-600 text-xs font-medium">Unit Types</p>
                      <p className="text-xs">{selectedProject.unit_types}</p>
                    </div>
                  )}

                  {selectedProject.description && (
                    <div>
                      <p className="text-gray-600 text-xs font-medium">Description</p>
                      <p className="text-xs leading-relaxed">{selectedProject.description}</p>
                    </div>
                  )}

                  <div className="pt-2 border-t border-gray-200">
                    <p className="text-gray-600 text-xs font-medium">Location</p>
                    <p className="text-xs">
                      {selectedProject.lat.toFixed(4)}, {selectedProject.lon.toFixed(4)}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedProject(null)}
                  className="w-full mt-4 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
                >
                  Close
                </button>
              </div>
            ) : (
              <div className="border border-gray-200 rounded-lg p-4 bg-white text-center">
                <Home className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-600">
                  {searchTerm ? 'No projects found' : 'Select a project from the map to view details'}
                </p>
              </div>
            )}

            {/* Basemap Selector - Sidebar */}
            <div className="hidden md:block">
              <h4 className="font-semibold text-sm mb-2">Basemaps</h4>
              <p className="text-xs text-gray-600">Use the map control to switch basemaps</p>
            </div>

            {/* Favorites Section */}
            {favorites.length > 0 && (
              <div className="border-t border-gray-200 pt-4">
                <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                  <Heart className="w-4 h-4 text-danger" />
                  Favorites ({favorites.length})
                </h4>
                <div className="space-y-2">
                  {favorites.map(fav => (
                    <button
                      key={fav.id}
                      onClick={() => {
                        setSelectedProject(fav.project)
                        setSidebarOpen(false)
                      }}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors text-sm border border-gray-200"
                    >
                      <p className="font-medium text-foreground truncate">{fav.name}</p>
                      <p className="text-xs text-gray-600">{fav.project.boma_id}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Search Results */}
            {searchTerm && filteredProjects.length > 0 && (
              <div className="border-t border-gray-200 pt-4">
                <h4 className="font-semibold text-sm mb-3">Search Results ({filteredProjects.length})</h4>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {filteredProjects.map(project => (
                    <button
                      key={project.boma_id}
                      onClick={() => {
                        setSelectedProject(project)
                        setSidebarOpen(false)
                      }}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-blue-50 transition-colors text-sm border border-gray-200 hover:border-primary"
                    >
                      <p className="font-medium text-foreground truncate">{project.name}</p>
                      <p className="text-xs text-gray-600">{project.boma_id} • {project.units} units</p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar Overlay - Mobile */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 md:hidden z-30"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Map Container */}
        <div className="flex-1 flex flex-col overflow-hidden relative">
          {/* Mobile Toggle Button */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="md:hidden absolute top-4 left-4 z-20 bg-primary text-white p-2 rounded-lg hover:bg-primary-dark transition-colors shadow-lg"
            aria-label="Toggle sidebar"
          >
            <MapPin className="w-5 h-5" />
          </button>

          {/* Error State */}
          {error && (
            <div className="m-4 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
              <button
                onClick={() => window.location.reload()}
                className="block mt-2 text-red-600 font-medium hover:underline"
              >
                Try again
              </button>
            </div>
          )}

          {/* Loading State */}
          {isLoading ? (
            <div className="flex flex-1 items-center justify-center bg-gray-100">
              <div className="text-center">
                <div className="animate-spin mb-3">
                  <div className="w-8 h-8 border-4 border-gray-300 border-t-primary rounded-full"></div>
                </div>
                <p className="text-gray-600">Loading map and projects...</p>
              </div>
            </div>
          ) : (
            <div className="flex-1 p-4 overflow-hidden">
              <MapComponent
                projects={projects}
                onProjectSelect={setSelectedProject}
                onFavoritesChange={setFavorites}
              />
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  )
}
