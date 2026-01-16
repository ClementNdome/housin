// Map initialization and marker management
let map;
let markers = [];
let projects = [];

$(document).ready(function() {
    // Initialize map centered on Kitui County
    map = L.map('map').setView([-1.374, 38.010], 10);
    
    // Add OpenStreetMap tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(map);

    // Fetch projects and add markers
    $.get('/api/projects', function(data) {
        projects = data;
        addMarkersToMap(projects);
        loadFavorites();
    });
});

function addMarkersToMap(projectsData) {
    // Clear existing markers
    markers.forEach(marker => map.removeLayer(marker));
    markers = [];

    projectsData.forEach(function(project, index) {
        // Choose marker color based on status
        let markerColor = 'blue';
        if (project.status === 'complete') markerColor = 'green';
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
        <div class="card">
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
