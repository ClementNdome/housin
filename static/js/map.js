// Map initialization and marker management
let map;
let markers = [];
let projects = [];
let currentBasemap;

// Define available basemaps
const basemaps = {
    'OpenStreetMap': L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19
    }),
    'Satellite': L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: '© <a href="https://www.esri.com/">Esri</a>',
        maxZoom: 19
    }),
    'Terrain': L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://opentopomap.org">OpenTopoMap</a> contributors',
        maxZoom: 17
    }),
    'Dark': L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com/attributions">CARTO</a>',
        maxZoom: 19
    }),
    'Light': L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com/attributions">CARTO</a>',
        maxZoom: 19
    })
};

// Status to color mapping
const statusColorMap = {
    'completed': '#198754',
    'complete': '#198754',
    'ongoing': '#ffc107',
    'nearing completion': '#fd7e14',
    'planned': '#6c757d'
};

/**
 * Get marker color based on project status
 */
function getMarkerColor(status) {
    return statusColorMap[status.toLowerCase()] || '#2b5f8e';
}

$(document).ready(function() {
    initMap();
    loadProjects();
});

/**
 * Initialize Leaflet map
 */
function initMap() {
    $('#map').show();
    $('#map-loading').hide();
    
    map = L.map('map').setView([-1.374, 38.010], 10);
    
    const savedBasemap = localStorage.getItem('selectedBasemap') || 'Satellite';
    switchBasemap(savedBasemap);
    
    // Load subcounties layer (will appear faintly over the basemap)
    loadSubcountiesLayer();
    
    addBasemapSelector();
    L.control.scale({ imperial: false }).addTo(map);
    L.control.zoom({ position: 'topright' }).addTo(map);
    
    $(window).on('resize', function() {
        if (map) {
            setTimeout(() => map.invalidateSize(), 300);
        }
    });
}

/**
 * Load projects from API and add markers
 */
function loadProjects() {
    $.get('/api/projects')
        .done(function(data) {
            projects = data;
            addMarkersToMap(projects);
            loadFavorites();
            updateFavoriteCount();
            populateSearchDatalists();
        })
        .fail(function() {
            console.error('Failed to load projects');
            $('#map-loading').html('<div class="alert alert-warning"><i class="fas fa-exclamation-triangle me-2"></i>Failed to load projects. Please refresh.</div>');
        });
}

/**
 * Switch basemap layer
 */
function switchBasemap(basemapName) {
    if (currentBasemap) map.removeLayer(currentBasemap);
    
    if (basemaps[basemapName]) {
        currentBasemap = basemaps[basemapName];
        currentBasemap.addTo(map);
        localStorage.setItem('selectedBasemap', basemapName);
        updateBasemapSelector(basemapName);
    }
}

/**
 * Load and display Kitui subcounties GeoJSON layer
 * Shows faint polygon boundaries for subcounty visualization
 */
function loadSubcountiesLayer() {
    $.ajax({
        url: '/static/data/kitui_subcounties.geojson',
        dataType: 'json',
        success: function(geojsonData) {
            // Define styling for subcounties polygons - BOLD VISIBILITY
            const subcountiesStyle = {
                color: '#2c3e50',           // Dark blue-grey
                weight: 4,                   // Thick lines
                opacity: 0.9,                 // Almost solid
                           // Moderate fill
                // No dashArray
            };

            // Create GeoJSON layer
            const subcountiesLayer = L.geoJSON(geojsonData, {
                style: subcountiesStyle,
                onEachFeature: function(feature, layer) {
                    if (feature.properties && feature.properties.name) {
                        // Enhanced popup with better styling
                        const popupContent = `
                            <div style="
                                font-weight: 600; 
                                color: #2c3e50;
                                padding: 8px 12px;
                                background: #f8f9fa;
                                border-left: 4px solid #3498db;
                                border-radius: 4px;
                                min-width: 150px;
                            ">
                                <strong>Subcounty:</strong> ${feature.properties.name}
                            </div>
                        `;
                        
                        layer.on('mouseover', function(e) {
                            const anyPopupOpen = markers.some(m => m.isPopupOpen && m.isPopupOpen());
                            
                            // Dramatic hover effect
                            layer.setStyle({
                                color: '#e74c3c',
                                weight: 6,
                                opacity: 1,
                                
                                
                            });
                            
                            if (!anyPopupOpen) {
                                layer.bindPopup(popupContent).openPopup();
                            }
                            
                            layer.bringToFront();
                            L.DomEvent.stopPropagation(e);
                        });
                        
                        layer.on('mouseout', function(e) {
                            layer.setStyle(subcountiesStyle);
                            layer.closePopup();
                            L.DomEvent.stopPropagation(e);
                        });
                    }
                }
            });

            subcountiesLayer.addTo(map);
            window.subcountiesLayer = subcountiesLayer;
            
            // Optional: Fit bounds to show all subcounties
            // map.fitBounds(subcountiesLayer.getBounds());
        },
        error: function() {
            console.error('Failed to load subcounties GeoJSON layer');
        }
    });
}

/**
 * Add basemap selector control
 */
function addBasemapSelector() {
    const basemapControl = L.control({ position: 'topright' });
    
    basemapControl.onAdd = function(map) {
        const div = L.DomUtil.create('div', 'basemap-selector');
        div.setAttribute('style', 'z-index: 1001 !important; position: relative; margin-top: 68px;');
        
        const savedBasemap = localStorage.getItem('selectedBasemap') || 'Satellite';
        
        div.innerHTML = `
            <div class="basemap-selector-container" style="z-index: 1001;">
                <button class="basemap-toggle" type="button" title="Change Basemap" style="z-index: 1001; display: flex; align-items: center; justify-content: center; background: white; color: #1a4d47; border: 2px solid #dee2e6; border-radius: 4px; padding: 8px 10px; font-size: 1rem; cursor: pointer; font-weight: 600; white-space: nowrap; width: 40px; height: 40px; min-width: 40px;">
                    <i class="fas fa-layer-group"></i>
                </button>
                <div class="basemap-menu" style="display: none; z-index: 1005; position: absolute; top: 50px; right: 0; background: white; border: 1px solid #dee2e6; border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.15); min-width: 160px;">
                    ${Object.keys(basemaps).map(name => `
                        <button class="basemap-option ${name === savedBasemap ? 'active' : ''}" data-basemap="${name}" style="z-index: 1005; display: block; width: 100%; text-align: left; background: ${name === savedBasemap ? '#f0f0f0' : 'white'}; color: #495057; border: none; padding: 10px 12px; font-size: 0.85rem; cursor: pointer; transition: all 0.2s;">
                            <i class="fas fa-map" style="margin-right: 6px;"></i>${name}
                        </button>
                    `).join('')}
                </div>
            </div>
        `;
        
        L.DomEvent.disableClickPropagation(div);
        L.DomEvent.disableScrollPropagation(div);
        
        const toggleBtn = div.querySelector('.basemap-toggle');
        const menu = div.querySelector('.basemap-menu');
        
        L.DomEvent.on(toggleBtn, 'click', function(e) {
            L.DomEvent.stopPropagation(e);
            e.preventDefault();
            menu.style.display = menu.style.display !== 'none' ? 'none' : 'block';
        });
        
        div.querySelectorAll('.basemap-option').forEach(option => {
            L.DomEvent.on(option, 'click', function(e) {
                L.DomEvent.stopPropagation(e);
                e.preventDefault();
                switchBasemap(option.dataset.basemap);
                menu.style.display = 'none';
            });
        });
        
        L.DomEvent.on(document, 'click', function(e) {
            if (!div.contains(e.target)) menu.style.display = 'none';
        });
        
        return div;
    };
    
    basemapControl.addTo(map);
    
    // Ensure control is visible on all screen sizes
    setTimeout(() => {
        const controlContainer = document.querySelector('.leaflet-top.leaflet-right');
        if (controlContainer) {
            controlContainer.style.zIndex = '1002';
            controlContainer.style.right = '10px';
            controlContainer.style.top = '10px';
        }
    }, 100);
}

/**
 * Update basemap selector UI
 */
function updateBasemapSelector(selectedBasemap) {
    document.querySelectorAll('.basemap-option').forEach(option => {
        option.classList.toggle('active', option.dataset.basemap === selectedBasemap);
    });
}

/**
 * Populate search datalists
 */
function populateSearchDatalists() {
    const list = projects.map(p => `<option value="${p.name}">${p.name} - ${p.status}</option>`).join('');
    $('#projects-list, #mobile-projects-list').html(list);
}

/**
 * Add markers to map
 */
function addMarkersToMap(projectsData) {
    markers.forEach(marker => map.removeLayer(marker));
    markers = [];

    projectsData.forEach(function(project, index) {
        const markerColor = getMarkerColor(project.status);
        
        const icon = L.divIcon({
            className: 'custom-marker',
            html: `<div style="background-color: ${markerColor}; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; cursor: pointer;"><div style="width: 8px; height: 8px; background-color: white; border-radius: 50%;"></div></div>`,
            iconSize: [24, 24],
            iconAnchor: [12, 12],
            popupAnchor: [0, -12]
        });

        const marker = L.marker([project.lat, project.lon], { icon: icon, title: project.name }).addTo(map);
        
        const popupContent = `
            <div class="popup-content">
                <div class="d-flex justify-content-between align-items-start mb-2">
                    <h6 class="mb-0" style="color: #1a4d47;">${project.name}</h6>
                    <span class="badge" style="background-color: ${markerColor}; color: white;">${project.status}</span>
                </div>
                <small><strong>ID:</strong> ${project.boma_id}</small><br>
                <small><strong>Units:</strong> ${project.units.toLocaleString()}</small>
                ${project.price_start ? `<br><small><strong>From:</strong> KES ${project.price_start.toLocaleString()}</small>` : ''}
                ${project.image ? `<div class="mt-2"><img src="${project.image}" alt="${project.name}" loading="lazy" style="width: 100%; height: 120px; object-fit: cover; border-radius: 4px;" onerror="this.style.display='none'"></div>` : ''}
                <div class="d-grid gap-2 mt-2">
                    <button class="btn btn-sm btn-primary" onclick="showProjectInSidebar(${index})"><i class="fas fa-info-circle me-1"></i>Details</button>
                    <button class="btn btn-sm btn-outline-secondary" onclick="toggleFavorite(${index})"><span id="fav-icon-${index}">${isProjectFavorite(index) ? '⭐' : '☆'}</span> Favorite</button>
                </div>
            </div>
        `;
        
        marker.bindPopup(popupContent, { maxWidth: 300, className: 'custom-popup', closeButton: true });
        marker.projectIndex = index;
        markers.push(marker);

        marker.on('click', function() {
            markers.forEach(m => { if (m !== marker && m.isPopupOpen()) m.closePopup(); });
            showProjectInSidebar(index);
        });
    });
}

/**
 * Show project details in sidebar
 */
function showProjectDetails(index) {
    const project = projects[index];
    if (!project) return;

    const markerColor = getMarkerColor(project.status);

    const detailsHtml = `
        <div class="card border-0 shadow-sm">
            ${project.image ? `<div style="height: 180px; overflow: hidden;"><img src="${project.image}" alt="${project.name}" loading="lazy" style="width: 100%; height: 100%; object-fit: cover;"></div>` : `<div style="height: 120px; background: linear-gradient(135deg, #1a4d47, #2d6f65); display: flex; align-items: center; justify-content: center;"><i class="fas fa-building fa-3x" style="color: white; opacity: 0.7;"></i></div>`}
            <div class="card-body">
                <div class="d-flex justify-content-between align-items-start mb-3">
                    <h5 class="card-title mb-0" style="color: #1a4d47;">${project.name}</h5>
                    <span class="badge" style="background-color: ${markerColor}; color: white; padding: 6px 12px;">${project.status}</span>
                </div>
                
                <div class="project-meta mb-3">
                    <div class="d-flex align-items-center mb-2">
                        <i class="fas fa-hashtag me-2" style="color: #5a7572;"></i>
                        <span><strong>Boma ID:</strong> ${project.boma_id}</span>
                    </div>
                    <div class="d-flex align-items-center mb-2">
                        <i class="fas fa-building me-2" style="color: #5a7572;"></i>
                        <span><strong>Units:</strong> ${project.units.toLocaleString()}</span>
                    </div>
                    ${project.unit_types ? `<div class="d-flex align-items-center mb-2"><i class="fas fa-home me-2" style="color: #5a7572;"></i><span><strong>Types:</strong> ${project.unit_types}</span></div>` : ''}
                    ${project.price_start ? `<div class="d-flex align-items-center mb-2"><i class="fas fa-money-bill-wave me-2" style="color: #5a7572;"></i><span><strong>From:</strong> KES ${project.price_start.toLocaleString()}</span></div>` : ''}
                    <div class="d-flex align-items-center">
                        <i class="fas fa-map-marker-alt me-2" style="color: #5a7572;"></i>
                        <span><strong>Location:</strong> ${project.lat.toFixed(4)}, ${project.lon.toFixed(4)}</span>
                    </div>
                </div>
                
                ${project.description ? `<div class="mb-3"><h6 class="text-muted mb-2">Description</h6><p class="card-text" style="color: #5a7572; font-size: 0.9rem;">${project.description}</p></div>` : ''}
                
                <div class="d-grid gap-2">
                    <button class="btn btn-primary" onclick="focusOnProject(${index})">
                        <i class="fas fa-crosshairs me-1"></i>Focus on Map
                    </button>
                    <button class="btn btn-outline-secondary" onclick="toggleFavorite(${index})">
                        <span id="fav-icon-sidebar-${index}">${isProjectFavorite(index) ? '⭐' : '☆'}</span> 
                        ${isProjectFavorite(index) ? 'Remove from Favorites' : 'Add to Favorites'}
                    </button>
                </div>
            </div>
        </div>
    `;

    $('#project-details').html(detailsHtml);
}

/**
 * Show project in sidebar
 */
function showProjectInSidebar(index) {
    showProjectDetails(index);
    
    if (window.innerWidth < 992) {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebarOverlay');
        if (sidebar && overlay) {
            sidebar.classList.add('show');
            overlay.classList.add('show');
            document.body.style.overflow = 'hidden';
        }
    }
}

/**
 * Close project details panel
 */
function closeProjectDetails() {
    // Clear the project details
    $('#project-details').html('');
    
    // Close sidebar on mobile
    if (window.innerWidth < 992) {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebarOverlay');
        if (sidebar && overlay) {
            sidebar.classList.remove('show');
            overlay.classList.remove('show');
            document.body.style.overflow = 'auto';
        }
    }
}

/**
 * Check if project is favorited
 */
function isProjectFavorite(index) {
    const favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
    const projectId = projects[index]?.boma_id + '-' + projects[index]?.name;
    return favorites.includes(projectId);
}

/**
 * Toggle favorite status
 */
function toggleFavorite(index) {
    let favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
    const projectId = projects[index].boma_id + '-' + projects[index].name;
    
    if (favorites.includes(projectId)) {
        favorites = favorites.filter(id => id !== projectId);
        showToast('Removed from saved', 'info');
    } else {
        favorites.push(projectId);
        showToast('Added to saved', 'success');
    }
    
    localStorage.setItem('favorites', JSON.stringify(favorites));
    updateFavoriteIcon(index);
    loadFavorites();
    updateFavoriteCount();
}

/**
 * Update favorite icon
 */
function updateFavoriteIcon(index) {
    const isFavorite = isProjectFavorite(index);
    $(`#fav-icon-${index}, #fav-icon-sidebar-${index}`).text(isFavorite ? '⭐' : '☆');
}

/**
 * Load and display favorites
 */
function loadFavorites() {
    const favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
    
    if (!favorites.length) {
        $('#favorites-list').html('<div class="text-center text-muted py-3"><i class="fas fa-star fa-lg mb-2" style="color: #ffc107;"></i><p class="small mb-0">No saved projects</p></div>');
        return;
    }
    
    let html = '';
    favorites.forEach(favId => {
        const project = projects.find(p => (p.boma_id + '-' + p.name) === favId);
        if (project) {
            const index = projects.indexOf(project);
            html += `
                <a href="#" class="list-group-item list-group-item-action" 
                   onclick="showProjectInSidebar(${index}); focusOnProject(${index}); return false;">
                    <div class="d-flex justify-content-between align-items-center">
                        <div>
                            <strong style="color: #1a4d47;">${project.name}</strong><br>
                            <small class="text-muted">${project.status} • ${project.units} units</small>
                        </div>
                        <i class="fas fa-chevron-right" style="color: #5a7572;"></i>
                    </div>
                </a>
            `;
        }
    });
    
    $('#favorites-list').html(html);
}

/**
 * Update favorite count badge
 */
function updateFavoriteCount() {
    const count = JSON.parse(localStorage.getItem('favorites') || '[]').length;
    const badge = document.getElementById('favoriteCountBadge');
    const sidebar = document.getElementById('sidebarFavoriteCount');
    
    if (badge) badge.style.display = count > 0 ? 'block' : 'none';
    if (badge) badge.textContent = count;
    if (sidebar) sidebar.textContent = count;
}

/**
 * Focus map on project and open popup
 */
function focusOnProject(index) {
    const project = projects[index];
    if (!project) return;
    
    // Close sidebar on mobile
    if (window.innerWidth < 992) {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebarOverlay');
        if (sidebar && overlay) {
            sidebar.classList.remove('show');
            overlay.classList.remove('show');
            document.body.style.overflow = '';
        }
    }
    
    map.flyTo([project.lat, project.lon], 15, { duration: 1.5, easeLinearity: 0.25 });
    
    const marker = markers.find(m => m.projectIndex === index);
    if (marker) setTimeout(() => marker.openPopup(), 1500);
}

/**
 * Show toast notification
 */
function showToast(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.style.cssText = 'position: fixed; bottom: 20px; right: 20px; z-index: 9999;';
        document.body.appendChild(container);
    }
    
    const bgColors = { success: '#d1e7dd', error: '#f8d7da', info: '#d1ecf1' };
    const borderColors = { success: '#badbcc', error: '#f5c2c7', info: '#bee5eb' };
    const textColors = { success: '#0f5132', error: '#842029', info: '#055160' };
    const icons = { success: 'check-circle', error: 'exclamation-circle', info: 'info-circle' };
    
    const toastId = 'toast-' + Date.now();
    const toast = document.createElement('div');
    toast.id = toastId;
    toast.className = 'toast show';
    toast.style.cssText = `min-width: 250px; background-color: ${bgColors[type]}; border: 1px solid ${borderColors[type]}; color: ${textColors[type]}; border-radius: 8px; padding: 12px 16px; margin-bottom: 10px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);`;
    
    toast.innerHTML = `
        <div class="d-flex justify-content-between align-items-center">
            <div class="d-flex align-items-center">
                <i class="fas fa-${icons[type]} me-2"></i>
                <span>${message}</span>
            </div>
            <button type="button" class="btn-close btn-close-${type}" onclick="document.getElementById('${toastId}').remove()" style="font-size: 0.75rem; padding: 0.25rem;"></button>
        </div>
    `;
    
    container.appendChild(toast);
    setTimeout(() => { if (toast.parentNode) toast.remove(); }, 3000);
}

// Make functions available globally
window.showProjectDetails = showProjectDetails;
window.showProjectInSidebar = showProjectInSidebar;
window.toggleFavorite = toggleFavorite;
window.switchBasemap = switchBasemap;
window.focusOnProject = focusOnProject;
window.isProjectFavorite = isProjectFavorite;