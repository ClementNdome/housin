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
    }),
    'Watercolor': L.tileLayer('https://stamen-tiles-{s}.a.ssl.fastly.net/watercolor/{z}/{x}/{y}.jpg', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, © <a href="https://stamen.com">Stamen Design</a>',
        maxZoom: 18
    })
};

$(document).ready(function() {
    // Calculate map height based on device
    function calculateMapHeight() {
        const isMobile = window.innerWidth < 992;
        const navbarHeight = 76; // Navbar height
        const mobileSearchHeight = isMobile ? 70 : 0; // Mobile search bar height
        
        return `calc(100vh - ${navbarHeight}px ${isMobile ? `- ${mobileSearchHeight}px` : ''})`;
    }
    
    // Set map height
    const mapHeight = calculateMapHeight();
    $('#map').css('height', mapHeight);
    
    // Show map and hide loading indicator
    $('#map').show();
    $('#map-loading').hide();
    
    // Initialize map centered on Kitui County
    map = L.map('map').setView([-1.374, 38.010], 10);
    
    // Load saved basemap preference or use default
    const savedBasemap = localStorage.getItem('selectedBasemap') || 'OpenStreetMap';
    switchBasemap(savedBasemap);
    
    // Add basemap selector control (position adjusted for mobile)
    addBasemapSelector();
    
    // Add scale control
    L.control.scale({ imperial: false }).addTo(map);
    
    // Add zoom control with proper positioning
    L.control.zoom({
        position: 'topright'
    }).addTo(map);
    
    // Handle window resize
    $(window).on('resize', function() {
        const newHeight = calculateMapHeight();
        $('#map').css('height', newHeight);
        if (map) {
            map.invalidateSize();
        }
    });
    
    // Fetch projects and add markers
    $.get('/api/projects')
        .done(function(data) {
            projects = data;
            addMarkersToMap(projects);
            loadFavorites();
            updateFavoriteCount();
            
            // Populate datalists for both search inputs
            populateSearchDatalists();
        })
        .fail(function() {
            console.error('Failed to load projects');
            $('#map-loading').html(`
                <div class="alert alert-warning">
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    Failed to load projects. Please refresh the page.
                </div>
            `);
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

function addBasemapSelector() {
    // Create basemap selector control
    const basemapControl = L.control({ 
        position: window.innerWidth < 992 ? 'bottomright' : 'topright' 
    });
    
    basemapControl.onAdd = function(map) {
        const div = L.DomUtil.create('div', 'basemap-selector');
        const savedBasemap = localStorage.getItem('selectedBasemap') || 'OpenStreetMap';
        
        div.innerHTML = `
            <div class="basemap-selector-container">
                <button class="btn btn-sm btn-light basemap-toggle" type="button" title="Change Basemap">
                    <i class="fas fa-layer-group"></i>
                    <span class="d-none d-md-inline"> Basemap</span>
                </button>
                <div class="basemap-menu" style="display: none;">
                    ${Object.keys(basemaps).map(name => `
                        <button class="basemap-option ${name === savedBasemap ? 'active' : ''}" 
                                data-basemap="${name}">
                            <i class="fas fa-map me-2"></i>${name}
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
        
        // Close menu when clicking outside
        setTimeout(() => {
            L.DomEvent.on(document, 'click', function(e) {
                if (!div.contains(e.target) && menu.style.display !== 'none') {
                    menu.style.display = 'none';
                }
            });
        }, 100);
        
        return div;
    };
    
    basemapControl.addTo(map);
}

function updateBasemapSelector(selectedBasemap) {
    document.querySelectorAll('.basemap-option').forEach(option => {
        if (option.dataset.basemap === selectedBasemap) {
            option.classList.add('active');
        } else {
            option.classList.remove('active');
        }
    });
}

function populateSearchDatalists() {
    const desktopDatalist = document.getElementById('projects-list');
    const mobileDatalist = document.getElementById('mobile-projects-list');
    
    if (desktopDatalist) desktopDatalist.innerHTML = '';
    if (mobileDatalist) mobileDatalist.innerHTML = '';
    
    projects.forEach(project => {
        const option = `<option value="${project.name}">${project.name} - ${project.status}</option>`;
        if (desktopDatalist) desktopDatalist.innerHTML += option;
        if (mobileDatalist) mobileDatalist.innerHTML += option;
    });
}

function addMarkersToMap(projectsData) {
    // Clear existing markers
    markers.forEach(marker => map.removeLayer(marker));
    markers = [];

    projectsData.forEach(function(project, index) {
        // Choose marker color based on status
        let markerColor = '#2b5f8e'; // Default blue
        if (project.status === 'completed' || project.status === 'complete') markerColor = '#198754'; // Green
        else if (project.status === 'ongoing') markerColor = '#ffc107'; // Yellow/Orange
        else if (project.status === 'nearing completion') markerColor = '#fd7e14'; // Orange
        else if (project.status === 'planned') markerColor = '#6c757d'; // Gray

        // Create custom icon
        const icon = L.divIcon({
            className: 'custom-marker',
            html: `
                <div style="
                    background-color: ${markerColor};
                    width: ${window.innerWidth < 768 ? '20px' : '24px'};
                    height: ${window.innerWidth < 768 ? '20px' : '24px'};
                    border-radius: 50%;
                    border: 3px solid white;
                    box-shadow: 0 2px 6px rgba(0,0,0,0.3);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    transition: all 0.2s;
                ">
                    <div style="
                        width: 6px;
                        height: 6px;
                        background-color: white;
                        border-radius: 50%;
                    "></div>
                </div>
            `,
            iconSize: window.innerWidth < 768 ? [20, 20] : [24, 24],
            iconAnchor: window.innerWidth < 768 ? [10, 10] : [12, 12],
            popupAnchor: window.innerWidth < 768 ? [0, -10] : [0, -12]
        });

        // Create marker
        const marker = L.marker([project.lat, project.lon], { 
            icon: icon,
            title: project.name
        }).addTo(map);
        
        // Create popup content
        const popupContent = `
            <div class="popup-content" style="min-width: ${window.innerWidth < 768 ? '200px' : '250px'};">
                <div class="d-flex justify-content-between align-items-start mb-2">
                    <h6 class="mb-0" style="color: #1a4d47; font-size: ${window.innerWidth < 768 ? '0.9rem' : '1rem'};">${project.name}</h6>
                    <span class="badge" style="background-color: ${markerColor}; color: white; font-size: ${window.innerWidth < 768 ? '0.7rem' : '0.8rem'};">${project.status}</span>
                </div>
                <div class="mb-1">
                    <small><strong>Boma ID:</strong> ${project.boma_id}</small>
                </div>
                <div class="mb-1">
                    <small><strong>Units:</strong> ${project.units.toLocaleString()}</small>
                </div>
                ${project.price_start ? `
                    <div class="mb-2">
                        <small><strong>Price Start:</strong> KES ${project.price_start.toLocaleString()}</small>
                    </div>
                ` : ''}
                ${project.image ? `
                    <div class="mb-2">
                        <img src="${project.image}" alt="${project.name}" 
                             style="width: 100%; height: ${window.innerWidth < 768 ? '80px' : '120px'}; object-fit: cover; border-radius: 4px;"
                             onerror="this.style.display='none'">
                    </div>
                ` : ''}
                <div class="d-grid gap-2 mt-2">
                    <button class="btn btn-sm btn-primary" onclick="showProjectInSidebar(${index})" style="font-size: ${window.innerWidth < 768 ? '0.8rem' : '0.9rem'};">
                        <i class="fas fa-info-circle me-1"></i>View Details
                    </button>
                    <button class="btn btn-sm btn-outline-secondary" onclick="toggleFavorite(${index})" style="font-size: ${window.innerWidth < 768 ? '0.8rem' : '0.9rem'};">
                        <span id="fav-icon-${index}">${isProjectFavorite(index) ? '⭐' : '☆'}</span> 
                        ${isProjectFavorite(index) ? 'Remove Favorite' : 'Add to Favorites'}
                    </button>
                </div>
            </div>
        `;
        
        marker.bindPopup(popupContent, {
            maxWidth: window.innerWidth < 768 ? 250 : 300,
            className: 'custom-popup',
            closeButton: true
        });

        // Store marker with project reference
        marker.projectIndex = index;
        markers.push(marker);

        // Add click event to show details in sidebar
        marker.on('click', function() {
            // Close any other open popups
            markers.forEach(m => {
                if (m !== marker && m.isPopupOpen()) {
                    m.closePopup();
                }
            });
            
            // Show in sidebar
            showProjectInSidebar(index);
        });
    });
}


function showProjectDetails(index) {
    const project = projects[index];
    if (!project) return;

    // Determine marker color based on status
    let markerColor = '#2b5f8e';
    if (project.status === 'completed' || project.status === 'complete') markerColor = '#198754';
    else if (project.status === 'ongoing') markerColor = '#ffc107';
    else if (project.status === 'nearing completion') markerColor = '#fd7e14';
    else if (project.status === 'planned') markerColor = '#6c757d';

    const detailsHtml = `
        <div class="card border-0 shadow-sm">
            ${project.image ? `
                <div style="height: 180px; overflow: hidden;">
                    <img src="${project.image}" alt="${project.name}" 
                         style="width: 100%; height: 100%; object-fit: cover;">
                </div>
            ` : `
                <div style="height: 120px; background: linear-gradient(135deg, #1a4d47, #2d6f65); display: flex; align-items: center; justify-content: center;">
                    <i class="fas fa-building fa-3x" style="color: white; opacity: 0.7;"></i>
                </div>
            `}
            <div class="card-body">
                <div class="d-flex justify-content-between align-items-start mb-3">
                    <h4 class="card-title mb-0" style="color: #1a4d47;">${project.name}</h4>
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
                    ${project.unit_types ? `
                        <div class="d-flex align-items-center mb-2">
                            <i class="fas fa-home me-2" style="color: #5a7572;"></i>
                            <span><strong>Unit Types:</strong> ${project.unit_types}</span>
                        </div>
                    ` : ''}
                    ${project.price_start ? `
                        <div class="d-flex align-items-center mb-2">
                            <i class="fas fa-money-bill-wave me-2" style="color: #5a7572;"></i>
                            <span><strong>Price Start:</strong> KES ${project.price_start.toLocaleString()}</span>
                        </div>
                    ` : ''}
                    <div class="d-flex align-items-center">
                        <i class="fas fa-map-marker-alt me-2" style="color: #5a7572;"></i>
                        <span><strong>Location:</strong> ${project.lat.toFixed(4)}, ${project.lon.toFixed(4)}</span>
                    </div>
                </div>
                
                ${project.description ? `
                    <div class="mb-3">
                        <h6 class="text-muted mb-2">Description</h6>
                        <p class="card-text" style="color: #5a7572;">${project.description}</p>
                    </div>
                ` : ''}
                
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

function isProjectFavorite(index) {
    const favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
    const projectId = projects[index]?.boma_id + '-' + projects[index]?.name;
    return favorites.includes(projectId);
}

function toggleFavorite(index) {
    let favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
    const projectId = projects[index].boma_id + '-' + projects[index].name;
    
    if (favorites.includes(projectId)) {
        favorites = favorites.filter(id => id !== projectId);
        showToast('Removed from favorites', 'info');
    } else {
        favorites.push(projectId);
        showToast('Added to favorites', 'success');
    }
    
    localStorage.setItem('favorites', JSON.stringify(favorites));
    updateFavoriteIcon(index);
    loadFavorites();
    updateFavoriteCount();
}

function updateFavoriteIcon(index) {
    const isFavorite = isProjectFavorite(index);
    
    $(`#fav-icon-${index}`).text(isFavorite ? '⭐' : '☆');
    $(`#fav-icon-sidebar-${index}`).text(isFavorite ? '⭐' : '☆');
    
    // Update button text
    $(`button[onclick="toggleFavorite(${index})"]`).html(`
        <span id="fav-icon-${index}">${isFavorite ? '⭐' : '☆'}</span> 
        ${isProjectFavorite(index) ? 'Remove Favorite' : 'Add to Favorites'}
    `);
}

function loadFavorites() {
    let favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
    const favoritesList = $('#favorites-list');
    
    if (favorites.length === 0) {
        favoritesList.html(`
            <div class="text-center text-muted py-3">
                <i class="fas fa-star fa-lg mb-2" style="color: #ffc107;"></i>
                <p class="small mb-0">No favorites yet</p>
                <small>Click the star icon on any project to add it</small>
            </div>
        `);
        return;
    }
    
    let favoritesHtml = '';
    favorites.forEach(favId => {
        const project = projects.find(p => (p.boma_id + '-' + p.name) === favId);
        if (project) {
            const index = projects.indexOf(project);
            favoritesHtml += `
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
    
    favoritesList.html(favoritesHtml);
}

function updateFavoriteCount() {
    const favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
    const count = favorites.length;
    
    // Update sidebar badge
    const sidebarBadge = document.getElementById('sidebarFavoriteCount');
    if (sidebarBadge) {
        sidebarBadge.textContent = count;
    }
    
    // Update floating button badge
    const badge = document.getElementById('favoriteCountBadge');
    if (badge) {
        if (count > 0) {
            badge.textContent = count;
            badge.style.display = 'block';
        } else {
            badge.style.display = 'none';
        }
    }
}

function focusOnProject(index) {
    const project = projects[index];
    if (!project) return;
    
    // Close sidebar on mobile
    if (window.innerWidth < 992) {
        const sidebar = document.getElementById('sidebar');
        const sidebarOverlay = document.getElementById('sidebarOverlay');
        
        if (sidebar && sidebarOverlay) {
            sidebar.classList.remove('show');
            sidebarOverlay.classList.remove('show');
            document.body.style.overflow = '';
        }
    }
    
    // Fly to project location
    map.flyTo([project.lat, project.lon], 15, {
        duration: 1.5,
        easeLinearity: 0.25
    });
    
    // Open marker popup
    const marker = markers.find(m => m.projectIndex === index);
    if (marker) {
        setTimeout(() => {
            marker.openPopup();
        }, 1500);
    }
}

function showToast(message, type = 'info') {
    // Create toast container if it doesn't exist
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        toastContainer.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 9999;
        `;
        document.body.appendChild(toastContainer);
    }
    
    // Create toast
    const toastId = 'toast-' + Date.now();
    const toast = document.createElement('div');
    toast.id = toastId;
    toast.className = 'toast show';
    toast.style.cssText = `
        min-width: 250px;
        background-color: ${type === 'success' ? '#d1e7dd' : type === 'error' ? '#f8d7da' : '#d1ecf1'};
        border: 1px solid ${type === 'success' ? '#badbcc' : type === 'error' ? '#f5c2c7' : '#bee5eb'};
        color: ${type === 'success' ? '#0f5132' : type === 'error' ? '#842029' : '#055160'};
        border-radius: 8px;
        padding: 12px 16px;
        margin-bottom: 10px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    `;
    
    toast.innerHTML = `
        <div class="d-flex justify-content-between align-items-center">
            <div class="d-flex align-items-center">
                <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'} me-2"></i>
                <span>${message}</span>
            </div>
            <button type="button" class="btn-close btn-close-${type}" onclick="document.getElementById('${toastId}').remove()" 
                    style="font-size: 0.75rem; padding: 0.25rem;">
            </button>
        </div>
    `;
    
    toastContainer.appendChild(toast);
    
    // Auto-remove after 3 seconds
    setTimeout(() => {
        if (toast.parentNode) {
            toast.remove();
        }
    }, 3000);
}

window.showProjectInSidebar = showProjectInSidebar;
window.switchBasemap = switchBasemap;


// Make functions available globally
window.showProjectDetails = showProjectDetails;
window.toggleFavorite = toggleFavorite;
//window.switchBasemap = switchBasemap;
window.showProjectInSidebar = showProjectInSidebar;
window.focusOnProject = focusOnProject;