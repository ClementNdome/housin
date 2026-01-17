// Search and autocomplete functionality
let allProjects = [];
let searchDebounceTimer;

$(document).ready(function() {
<<<<<<< Updated upstream
<<<<<<< Updated upstream
    // Load projects for autocomplete
    $.get('/api/projects', function(data) {
        allProjects = data;
        setupAutocomplete();
    });

    // Search form submission
    $('#search-form').on('submit', function(e) {
        e.preventDefault();
        performSearch();
=======
    // Load projects for autocomplete with error handling
    $.get('/api/projects')
        .done(function(data) {
            allProjects = data;
        })
        .fail(function() {
            console.error('Failed to load projects for search');
        });

=======
    // Load projects for autocomplete with error handling
    $.get('/api/projects')
        .done(function(data) {
            allProjects = data;
        })
        .fail(function() {
            console.error('Failed to load projects for search');
        });

>>>>>>> Stashed changes
    // Real-time search suggestions with debouncing for performance
    $('#search-input, #mobile-search-input').on('input', function(e) {
        const query = $(this).val().toLowerCase();
        
        // Clear previous timer
        clearTimeout(searchDebounceTimer);
        
        // Debounce search to avoid excessive function calls
        if (query.length > 1) {
            searchDebounceTimer = setTimeout(function() {
                showSearchSuggestions(query, e.target.id);
            }, 300); // Wait 300ms after user stops typing
        } else {
            hideSearchSuggestions();
        }
<<<<<<< Updated upstream
>>>>>>> Stashed changes
=======
>>>>>>> Stashed changes
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
