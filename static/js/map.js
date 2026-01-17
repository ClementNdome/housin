// Map initialization and marker management
let map;
let markers = [];
let projects = [];
let currentBasemap;
let basemapLayers = {};

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
    }),
    'Watercolor': L.tileLayer('https://stamen-tiles-{s}.a.ssl.fastly.net/watercolor/{z}/{x}/{y}.jpg', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, © <a href="https://stamen.com">Stamen Design</a>',
        maxZoom: 18
    })
};

$(document).ready(function() {
    // Show map and hide loading indicator
    $('#map').show();
    $('#map-loading').hide();
    
    // Initialize map centered on Kitui County
    map = L.map('map').setView([-1.374, 38.010], 10);
    
    // Load saved basemap preference or use default
    const savedBasemap = localStorage.getItem('selectedBasemap') || 'OpenStreetMap';
    switchBasemap(savedBasemap);
    
    // Add basemap selector control
    addBasemapSelector();

    // Fetch projects and add markers (with error handling)
    $.get('/api/projects')
        .done(function(data) {
            projects = data;
            addMarkersToMap(projects);
            loadFavorites();
        })
        .fail(function() {
            console.error('Failed to load projects');
            $('#map-loading').html('<div class="alert alert-warning">Failed to load projects. Please refresh the page.</div>');
        });
});

function switchBasemap(basemapName) {
    // Remove current basemap if it exists
    if (currentBasemap) {
        map.removeLayer(currentBasemap);
    }
    
    // Add new basemap
    if (basemaps[basemapName]) {
        currentBasemap = basemaps[basemapName];
        currentBasemap.addTo(map);
        
        // Save preference
        localStorage.setItem('selectedBasemap', basemapName);
        
        // Update selector UI
        updateBasemapSelector(basemapName);
    }
}

<<<<<<< Updated upstream
=======
/**
 * Load and display Kitui subcounties GeoJSON layer
 * Shows faint polygon boundaries for subcounty visualization
 */
function loadSubcountiesLayer() {
    $.ajax({
        url: '/static/data/kitui_subcounties.geojson',
        dataType: 'json',
        success: function(geojsonData) {
            // Define styling for subcounties polygons
            const subcountiesStyle = {
                color: '#1a4d47',           // Primary color
                weight: 1.5,                 // Thin lines
                opacity: 0.4,                // Faint (40% opacity)
                fillColor: '#e8eff0',       // Light neutral fill
                fillOpacity: 0.15,           // Very faint fill (15% opacity)
                dashArray: '5, 3'           // Dashed lines for subtle effect
            };

            // Create GeoJSON layer
            const subcountiesLayer = L.geoJSON(geojsonData, {
                style: subcountiesStyle,
                onEachFeature: function(feature, layer) {
                    // Add popup with subcounty name on hover
                    if (feature.properties && feature.properties.name) {
                        const popupContent = `<div style="font-weight: 500; color: #1a4d47;">${feature.properties.name}</div>`;
                        
                        // Show popup on mouseover - but don't interfere with marker selection
                        layer.on('mouseover', function(e) {
                            // Only show enhanced style if no marker is currently selected
                            const anyPopupOpen = markers.some(m => m.isPopupOpen());
                            if (!anyPopupOpen) {
                                layer.setStyle({
                                    opacity: 0.6,
                                    weight: 2,
                                    fillOpacity: 0.2
                                });
                                layer.bindPopup(popupContent).openPopup();
                            }
                            // Prevent event from propagating to map
                            L.DomEvent.stopPropagation(e);
                        });
                        
                        // Restore style on mouseout - only if no marker popup is open
                        layer.on('mouseout', function(e) {
                            const anyPopupOpen = markers.some(m => m.isPopupOpen());
                            if (!anyPopupOpen) {
                                layer.setStyle(subcountiesStyle);
                                layer.closePopup();
                            }
                            L.DomEvent.stopPropagation(e);
                        });
                    }
                }
            });

            // Add to map (will appear between basemap and markers)
            subcountiesLayer.addTo(map);
            
            // Store reference for layer management if needed
            window.subcountiesLayer = subcountiesLayer;
        },
        error: function() {
            console.error('Failed to load subcounties GeoJSON layer');
        }
    });
}

/**
 * Add basemap selector control
 */
>>>>>>> Stashed changes
function addBasemapSelector() {
    // Create basemap selector control
    const basemapControl = L.control({ position: 'topright' });
    
    basemapControl.onAdd = function(map) {
        const div = L.DomUtil.create('div', 'basemap-selector');
<<<<<<< Updated upstream
<<<<<<< Updated upstream
        const savedBasemap = localStorage.getItem('selectedBasemap') || 'OpenStreetMap';
        
        div.innerHTML = `
            <div class="basemap-selector-container">
                <button class="btn btn-sm btn-light basemap-toggle" type="button" title="Change Basemap">
                    🗺️ Basemap
                </button>
                <div class="basemap-menu" style="display: none;">
                    ${Object.keys(basemaps).map(name => `
                        <button class="basemap-option ${name === savedBasemap ? 'active' : ''}" 
                                data-basemap="${name}">
                            ${name}
=======
        div.setAttribute('style', 'z-index: 1001 !important; position: relative; margin-top: 68px;');
        
        const savedBasemap = localStorage.getItem('selectedBasemap') || 'Satellite';
        
        div.innerHTML = `
            <div class="basemap-selector-container" style="z-index: 1001;">
                <button class="basemap-toggle" type="button" title="Change Basemap" style="z-index: 1001; display: flex; align-items: center; justify-content: center; background: white; color: #1a4d47; border: 2px solid #dee2e6; border-radius: 4px; padding: 8px 10px; font-size: 1rem; cursor: pointer; font-weight: 600; white-space: nowrap; width: 40px; height: 40px; min-width: 40px;">
                    <i class="fas fa-layer-group"></i>
                </button>
                <div class="basemap-menu" style="display: none; z-index: 1005; position: absolute; top: 50px; right: 0; background: white; border: 1px solid #dee2e6; border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.15); min-width: 160px;">
                    ${Object.keys(basemaps).map(name => `
=======
        div.setAttribute('style', 'z-index: 1001 !important; position: relative; margin-top: 68px;');
        
        const savedBasemap = localStorage.getItem('selectedBasemap') || 'Satellite';
        
        div.innerHTML = `
            <div class="basemap-selector-container" style="z-index: 1001;">
                <button class="basemap-toggle" type="button" title="Change Basemap" style="z-index: 1001; display: flex; align-items: center; justify-content: center; background: white; color: #1a4d47; border: 2px solid #dee2e6; border-radius: 4px; padding: 8px 10px; font-size: 1rem; cursor: pointer; font-weight: 600; white-space: nowrap; width: 40px; height: 40px; min-width: 40px;">
                    <i class="fas fa-layer-group"></i>
                </button>
                <div class="basemap-menu" style="display: none; z-index: 1005; position: absolute; top: 50px; right: 0; background: white; border: 1px solid #dee2e6; border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.15); min-width: 160px;">
                    ${Object.keys(basemaps).map(name => `
>>>>>>> Stashed changes
                        <button class="basemap-option ${name === savedBasemap ? 'active' : ''}" data-basemap="${name}" style="z-index: 1005; display: block; width: 100%; text-align: left; background: ${name === savedBasemap ? '#f0f0f0' : 'white'}; color: #495057; border: none; padding: 10px 12px; font-size: 0.85rem; cursor: pointer; transition: all 0.2s;">
                            <i class="fas fa-map" style="margin-right: 6px;"></i>${name}
>>>>>>> Stashed changes
                        </button>
                    `).join('')}
                </div>
            </div>
        `;
        
        // Prevent map click when clicking on control
        L.DomEvent.disableClickPropagation(div);
        L.DomEvent.disableScrollPropagation(div);
        
        // Toggle menu on button click
        const toggleBtn = div.querySelector('.basemap-toggle');
        const menu = div.querySelector('.basemap-menu');
        
        L.DomEvent.on(toggleBtn, 'click', function(e) {
            L.DomEvent.stopPropagation(e);
            const isVisible = menu.style.display !== 'none';
            menu.style.display = isVisible ? 'none' : 'block';
        });
        
        // Handle basemap option clicks
        div.querySelectorAll('.basemap-option').forEach(option => {
            L.DomEvent.on(option, 'click', function(e) {
                L.DomEvent.stopPropagation(e);
                const basemapName = option.dataset.basemap;
                switchBasemap(basemapName);
                menu.style.display = 'none';
            });
        });
        
        // Close menu when clicking outside (with slight delay to allow option click)
        setTimeout(() => {
            L.DomEvent.on(document, 'click', function() {
                if (menu.style.display !== 'none') {
                    menu.style.display = 'none';
                }
            });
        }, 100);
        
        return div;
    };
    
    basemapControl.addTo(map);
    
    // Also add to sidebar
    addBasemapSelectorToSidebar();
}

function addBasemapSelectorToSidebar() {
    const savedBasemap = localStorage.getItem('selectedBasemap') || 'OpenStreetMap';
    const basemapHtml = `
        <div class="mb-4">
            <h5>🗺️ Basemap</h5>
            <select class="form-select form-select-sm" id="sidebar-basemap-selector" onchange="switchBasemap(this.value)">
                ${Object.keys(basemaps).map(name => `
                    <option value="${name}" ${name === savedBasemap ? 'selected' : ''}>${name}</option>
                `).join('')}
            </select>
        </div>
    `;
    
    // Insert after search form
    $('#search-form').after(basemapHtml);
}

function updateBasemapSelector(selectedBasemap) {
    // Update active state in map control
    document.querySelectorAll('.basemap-option').forEach(option => {
        if (option.dataset.basemap === selectedBasemap) {
            option.classList.add('active');
        } else {
            option.classList.remove('active');
        }
    });
    
    // Update sidebar selector
    const sidebarSelector = document.getElementById('sidebar-basemap-selector');
    if (sidebarSelector) {
        sidebarSelector.value = selectedBasemap;
    }
}

function addMarkersToMap(projectsData) {
    // Clear existing markers
    markers.forEach(marker => map.removeLayer(marker));
    markers = [];

    projectsData.forEach(function(project, index) {
        // Choose marker color based on status
        let markerColor = 'blue';
        if (project.status === 'completed' || project.status === 'complete') markerColor = 'green';
        else if (project.status === 'ongoing') markerColor = 'orange';
        else if (project.status === 'nearing completion') markerColor = 'yellow';
        else if (project.status === 'planned') markerColor = 'gray';

        // Create custom icon
        const icon = L.divIcon({
            className: 'custom-marker',
            html: `<div style="background-color: ${markerColor}; width: 20px; height: 20px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
            iconSize: [20, 20],
            iconAnchor: [10, 10]
        });

        // Create marker
        const marker = L.marker([project.lat, project.lon], { icon: icon }).addTo(map);
        
        // Create popup content
        const popupContent = `
            <div class="popup-content">
<<<<<<< Updated upstream
                <h5 class="mb-2">${project.name}</h5>
                <p class="mb-1"><strong>Status:</strong> <span class="badge bg-secondary">${project.status}</span></p>
                <p class="mb-1"><strong>Units:</strong> ${project.units.toLocaleString()}</p>
                ${project.price_start ? `<p class="mb-1"><strong>Price Start:</strong> KES ${project.price_start.toLocaleString()}</p>` : ''}
                ${project.image ? `<img src="${project.image}" alt="${project.name}" class="img-fluid mt-2 mb-2" style="max-height: 200px; width: 100%; object-fit: cover; border-radius: 4px;" onerror="this.style.display='none'">` : ''}
                <p class="mb-1"><strong>Boma ID:</strong> ${project.boma_id}</p>
                <button class="btn btn-sm btn-primary mt-2" onclick="showProjectDetails(${index})">View Details</button>
                <button class="btn btn-sm btn-outline-secondary mt-2" onclick="toggleFavorite(${index})">
                    <span id="fav-icon-${index}">⭐</span> Favorite
                </button>
=======
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
>>>>>>> Stashed changes
            </div>
        `;
        
        marker.bindPopup(popupContent, {
            maxWidth: 300,
            className: 'custom-popup'
        });

        // Store marker with project reference
        marker.projectIndex = index;
        markers.push(marker);

        // Add click event to show details in sidebar
        marker.on('click', function() {
            showProjectDetails(index);
        });
    });
}

function showProjectDetails(index) {
    const project = projects[index];
    if (!project) return;

    const detailsHtml = `
<<<<<<< Updated upstream
        <div class="card">
=======
        <div class="card border-0 shadow-sm">
            ${project.image ? `<div style="height: 180px; overflow: hidden;"><img src="${project.image}" alt="${project.name}" loading="lazy" style="width: 100%; height: 100%; object-fit: cover;"></div>` : `<div style="height: 120px; background: linear-gradient(135deg, #1a4d47, #2d6f65); display: flex; align-items: center; justify-content: center;"><i class="fas fa-building fa-3x" style="color: white; opacity: 0.7;"></i></div>`}
<<<<<<< Updated upstream
>>>>>>> Stashed changes
=======
>>>>>>> Stashed changes
            <div class="card-body">
                ${project.image ? `<img src="${project.image}" alt="${project.name}" class="img-fluid mb-3" style="width: 100%; max-height: 200px; object-fit: cover; border-radius: 4px;" onerror="this.style.display='none'">` : ''}
                <h4 class="card-title">${project.name}</h4>
                <p class="card-text">
                    <strong>Boma ID:</strong> ${project.boma_id}<br>
                    <strong>Status:</strong> <span class="badge bg-secondary">${project.status}</span><br>
                    <strong>Units:</strong> ${project.units.toLocaleString()}<br>
                    ${project.unit_types ? `<strong>Unit Types:</strong> ${project.unit_types}<br>` : ''}
                    ${project.price_start ? `<strong>Price Start:</strong> KES ${project.price_start.toLocaleString()}<br>` : ''}
                </p>
                <p class="card-text"><small class="text-muted">${project.description || 'No description available.'}</small></p>
                <button class="btn btn-sm btn-outline-secondary" onclick="toggleFavorite(${index})">
                    <span id="fav-icon-sidebar-${index}">⭐</span> Toggle Favorite
                </button>
            </div>
        </div>
    `;

    $('#project-details').html(detailsHtml);
    updateFavoriteIcon(index);
}

function toggleFavorite(index) {
    let favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
    const projectId = projects[index].boma_id + '-' + projects[index].name;
    
    if (favorites.includes(projectId)) {
        favorites = favorites.filter(id => id !== projectId);
    } else {
        favorites.push(projectId);
    }
    
    localStorage.setItem('favorites', JSON.stringify(favorites));
    updateFavoriteIcon(index);
    loadFavorites();
}

function updateFavoriteIcon(index) {
    let favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
    const projectId = projects[index].boma_id + '-' + projects[index].name;
    const isFavorite = favorites.includes(projectId);
    
    $(`#fav-icon-${index}`).text(isFavorite ? '⭐' : '☆');
    $(`#fav-icon-sidebar-${index}`).text(isFavorite ? '⭐' : '☆');
}

function loadFavorites() {
    let favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
    const favoritesList = $('#favorites-list');
    favoritesList.empty();
    
    if (favorites.length === 0) {
        favoritesList.html('<p class="text-muted small">No favorites yet. Click the star icon on any project to add it.</p>');
        return;
    }
    
    favorites.forEach(favId => {
        const project = projects.find(p => (p.boma_id + '-' + p.name) === favId);
        if (project) {
            const index = projects.indexOf(project);
            favoritesList.append(`
                <a href="#" class="list-group-item list-group-item-action" onclick="showProjectDetails(${index}); map.setView([${project.lat}, ${project.lon}], 15); return false;">
                    <strong>${project.name}</strong><br>
                    <small class="text-muted">${project.status} • ${project.units} units</small>
                </a>
            `);
        }
    });
}

// Make functions available globally
window.showProjectDetails = showProjectDetails;
window.toggleFavorite = toggleFavorite;
window.switchBasemap = switchBasemap;