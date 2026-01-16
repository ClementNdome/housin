// Search and autocomplete functionality
let allProjects = [];

$(document).ready(function() {
    // Load projects for autocomplete
    $.get('/api/projects', function(data) {
        allProjects = data;
        setupAutocomplete();
    });

    // Search form submission
    $('#search-form').on('submit', function(e) {
        e.preventDefault();
        performSearch();
    });
});

function setupAutocomplete() {
    const datalist = $('#projects-list');
    datalist.empty();
    
    allProjects.forEach(project => {
        datalist.append(`<option value="${project.name}">${project.name} - ${project.status}</option>`);
    });
}

function performSearch() {
    const query = $('#search-input').val().trim().toLowerCase();
    
    if (!query) {
        alert('Please enter a project name to search.');
        return;
    }

    // Find matching project
    const project = allProjects.find(p => 
        p.name.toLowerCase().includes(query) ||
        p.boma_id.toLowerCase().includes(query)
    );

    if (project) {
        const index = allProjects.indexOf(project);
        
        // Pan and zoom to project
        map.setView([project.lat, project.lon], 15);
        
        // Open popup on marker
        const marker = markers.find(m => m.projectIndex === index);
        if (marker) {
            marker.openPopup();
        }
        
        // Show details in sidebar
        if (typeof showProjectDetails === 'function') {
            showProjectDetails(index);
        }
        
        // Highlight search input
        $('#search-input').addClass('is-valid');
        setTimeout(() => $('#search-input').removeClass('is-valid'), 2000);
    } else {
        alert('Project not found. Please try another search term.');
        $('#search-input').addClass('is-invalid');
        setTimeout(() => $('#search-input').removeClass('is-invalid'), 2000);
    }
}

// Real-time search suggestions (optional enhancement)
$('#search-input').on('input', function() {
    const query = $(this).val().toLowerCase();
    if (query.length > 0) {
        // Filter and show suggestions
        const suggestions = allProjects.filter(p => 
            p.name.toLowerCase().includes(query)
        ).slice(0, 5);
        
        // Could implement a dropdown here if needed
    }
});
