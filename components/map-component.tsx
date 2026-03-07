'use client'

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import L from 'leaflet'
import { Project, Favorite } from '@/types'
import { cn } from '@/lib/utils'

interface MapComponentProps {
  projects: Project[]
  onProjectSelect?: (project: Project) => void
  onFavoritesChange?: (favorites: Favorite[]) => void
  initialBasemap?: string
}

// Basemap definitions
const BASEMAPS = {
  'OpenStreetMap': L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 19,
  }),
  'Satellite': L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: '© Esri',
    maxZoom: 19,
  }),
  'Terrain': L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenTopoMap contributors',
    maxZoom: 17,
  }),
  'Dark': L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '© OpenStreetMap contributors © CARTO',
    maxZoom: 19,
  }),
  'Light': L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '© OpenStreetMap contributors © CARTO',
    maxZoom: 19,
  }),
  'Watercolor': L.tileLayer('https://stamen-tiles-{s}.a.ssl.fastly.net/watercolor/{z}/{x}/{y}.jpg', {
    attribution: '© OpenStreetMap contributors © Stamen Design',
    maxZoom: 18,
  }),
} as const

type BasemapName = keyof typeof BASEMAPS

const STATUS_COLORS = {
  'completed': '#10b981',
  'complete': '#10b981',
  'ongoing': '#f97316',
  'nearing completion': '#eab308',
  'planned': '#6b7280',
} as const

export function MapComponent({
  projects,
  onProjectSelect,
  onFavoritesChange,
  initialBasemap = 'OpenStreetMap',
}: MapComponentProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const markersRef = useRef<L.Marker[]>([])
  const currentBasemapRef = useRef<L.TileLayer | null>(null)
  const [selectedBasemap, setSelectedBasemap] = useState<BasemapName>(initialBasemap as BasemapName)
  const [favorites, setFavorites] = useState<Favorite[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Load favorites from localStorage
  useEffect(() => {
    const savedFavorites = localStorage.getItem('kituiHousingFavorites')
    if (savedFavorites) {
      try {
        setFavorites(JSON.parse(savedFavorites))
      } catch (error) {
        console.error('Error loading favorites:', error)
      }
    }
    setIsLoading(false)
  }, [])

  // Save favorites to localStorage
  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem('kituiHousingFavorites', JSON.stringify(favorites))
      onFavoritesChange?.(favorites)
    }
  }, [favorites, isLoading, onFavoritesChange])

  // Load basemap preference
  useEffect(() => {
    const savedBasemap = localStorage.getItem('kituiHousingBasemap')
    if (savedBasemap && savedBasemap in BASEMAPS) {
      setSelectedBasemap(savedBasemap as BasemapName)
    }
  }, [])

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current) return

    // Only initialize once
    if (map.current) return

    try {
      // Create map centered on Kitui County
      map.current = L.map(mapContainer.current).setView([-1.374, 38.010], 10)

      // Add initial basemap
      const basemapLayer = BASEMAPS[selectedBasemap as BasemapName]
      basemapLayer.addTo(map.current)
      currentBasemapRef.current = basemapLayer

      // Add basemap control
      addBasemapControl()

      console.log('[v0] Map initialized successfully')
    } catch (error) {
      console.error('[v0] Error initializing map:', error)
    }
  }, [selectedBasemap])

  // Add basemap control to map
  const addBasemapControl = useCallback(() => {
    if (!map.current) return

    const BasemapControl = L.Control.extend({
      onAdd: function() {
        const container = L.DomUtil.create('div', 'basemap-control')
        container.innerHTML = `
          <div style="background: white; border-radius: 4px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); overflow: hidden; min-width: 120px;">
            <button id="basemap-toggle" style="
              width: 100%; padding: 8px 12px; border: none; background: white;
              font-weight: 500; cursor: pointer; font-size: 14px;
            ">🗺️ Basemap</button>
            <div id="basemap-menu" style="display: none; border-top: 1px solid #e5e7eb; max-height: 300px; overflow-y: auto;">
              ${Object.keys(BASEMAPS).map(name => `
                <button class="basemap-option" data-basemap="${name}" style="
                  width: 100%; padding: 8px 12px; border: none; background: white;
                  text-align: left; cursor: pointer; font-size: 14px; transition: all 0.2s;
                  ${name === selectedBasemap ? 'background-color: #dbeafe; color: #1a4d47; font-weight: 600;' : ''}
                ">
                  ${name}
                </button>
              `).join('')}
            </div>
          </div>
        `

        L.DomEvent.disableClickPropagation(container)
        L.DomEvent.disableScrollPropagation(container)

        const toggle = container.querySelector('#basemap-toggle') as HTMLElement
        const menu = container.querySelector('#basemap-menu') as HTMLElement

        if (toggle && menu) {
          toggle.addEventListener('click', () => {
            menu.style.display = menu.style.display === 'none' ? 'block' : 'none'
          })

          container.querySelectorAll('.basemap-option').forEach(option => {
            option.addEventListener('click', (e) => {
              const basemapName = (e.target as HTMLElement).dataset.basemap
              if (basemapName && basemapName in BASEMAPS) {
                switchBasemap(basemapName as BasemapName)
                menu.style.display = 'none'
              }
            })
          })
        }

        return container
      },
    })

    new BasemapControl({ position: 'topright' }).addTo(map.current!)
  }, [selectedBasemap])

  // Switch basemap
  const switchBasemap = useCallback((basemapName: BasemapName) => {
    if (!map.current) return

    // Remove current basemap
    if (currentBasemapRef.current) {
      map.current.removeLayer(currentBasemapRef.current)
    }

    // Add new basemap
    const newBasemap = BASEMAPS[basemapName]
    newBasemap.addTo(map.current)
    currentBasemapRef.current = newBasemap

    // Save preference
    localStorage.setItem('kituiHousingBasemap', basemapName)
    setSelectedBasemap(basemapName)

    // Update UI
    updateBasemapUI(basemapName)
  }, [])

  // Update basemap UI
  const updateBasemapUI = useCallback((basemapName: BasemapName) => {
    document.querySelectorAll('.basemap-option').forEach(option => {
      const name = option.getAttribute('data-basemap')
      if (name === basemapName) {
        option.style.backgroundColor = '#dbeafe'
        option.style.color = '#1a4d47'
        option.style.fontWeight = '600'
      } else {
        option.style.backgroundColor = 'white'
        option.style.color = 'inherit'
        option.style.fontWeight = 'normal'
      }
    })
  }, [])

  // Add markers to map
  useEffect(() => {
    if (!map.current || isLoading) return

    // Clear existing markers
    markersRef.current.forEach(marker => {
      map.current?.removeLayer(marker)
    })
    markersRef.current = []

    // Add new markers
    projects.forEach(project => {
      const color = STATUS_COLORS[project.status as keyof typeof STATUS_COLORS] || '#3b82f6'
      
      const marker = L.marker([project.lat, project.lon], {
        icon: L.divIcon({
          className: 'custom-project-marker',
          html: `<div style="
            width: 24px; height: 24px; border-radius: 50%;
            background-color: ${color}; border: 3px solid white;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
          "></div>`,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
          popupAnchor: [0, -12],
        }),
      }).addTo(map.current!)

      // Create popup content
      const isFavorite = favorites.some(f => f.id === `${project.boma_id}-${project.name}`)
      const popupContent = document.createElement('div')
      popupContent.style.fontSize = '14px'
      popupContent.innerHTML = `
        <div style="min-width: 200px;">
          <div style="font-weight: 600; margin-bottom: 8px; color: #1f2937;">
            ${project.name}
          </div>
          <div style="display: flex; gap: 8px; margin-bottom: 8px;">
            <span style="
              background-color: ${color}; color: white;
              padding: 4px 8px; border-radius: 4px; font-size: 12px;
              font-weight: 600; text-transform: capitalize;
            ">${project.status}</span>
            <span style="
              background-color: #f3f4f6; color: #374151;
              padding: 4px 8px; border-radius: 4px; font-size: 12px;
              font-weight: 500;
            ">${project.units} Units</span>
          </div>
          ${project.price_start ? `
            <div style="margin-bottom: 8px; color: #374151; font-size: 13px;">
              <strong>Starting from:</strong> KES ${project.price_start.toLocaleString()}
            </div>
          ` : ''}
          <div style="margin-bottom: 8px; color: #6b7280; font-size: 13px; line-height: 1.4;">
            ${project.description || 'No description available'}
          </div>
          <div style="margin-bottom: 8px; color: #6b7280; font-size: 12px;">
            <strong>Boma ID:</strong> ${project.boma_id}
          </div>
          <button onclick="window.dispatchEvent(new CustomEvent('selectProject', { detail: ${JSON.stringify(project).replace(/"/g, '&quot;')} }))"
            style="
              width: 100%; padding: 8px 12px; background-color: #1a4d47;
              color: white; border: none; border-radius: 4px;
              font-weight: 600; cursor: pointer; font-size: 13px;
            ">View Details</button>
        </div>
      `

      marker.bindPopup(popupContent)

      // Handle marker click
      marker.on('click', () => {
        onProjectSelect?.(project)
      })

      markersRef.current.push(marker)
    })

    console.log(`[v0] Added ${projects.length} markers to map`)
  }, [projects, isLoading, favorites, onProjectSelect])

  // Handle toggle favorite
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

  const isFavorite = useCallback((project: Project) => {
    return favorites.some(f => f.id === `${project.boma_id}-${project.name}`)
  }, [favorites])

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Map Container */}
      <div
        ref={mapContainer}
        className="flex-1 rounded-lg border border-gray-200 overflow-hidden bg-gray-100"
        style={{ minHeight: '400px' }}
      />

      {/* Basemap Selector - Mobile */}
      <div className="md:hidden px-4">
        <select
          value={selectedBasemap}
          onChange={(e) => switchBasemap(e.target.value as BasemapName)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
        >
          {Object.keys(BASEMAPS).map(name => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin">
            <div className="w-8 h-8 border-4 border-gray-300 border-t-primary rounded-full"></div>
          </div>
          <span className="ml-2 text-gray-600">Loading map...</span>
        </div>
      )}
    </div>
  )
}
