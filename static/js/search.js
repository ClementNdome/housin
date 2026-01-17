// Search and autocomplete functionality
let allProjects = [];
let searchDebounceTimer;

$(document).ready(function() {
    // Load projects for autocomplete with error handling
    $.get('/api/projects')
        .done(function(data) {
            allProjects = data;
        })
        .fail(function() {
            console.error('Failed to load projects for search');
        });

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
    });
});

/**
 * Display search suggestions dropdown
 */
function showSearchSuggestions(query, inputId) {
    $('#search-suggestions').remove();
    
    const suggestions = allProjects
        .filter(p => p.name.toLowerCase().includes(query) || p.boma_id.toLowerCase().includes(query))
        .slice(0, 5);
    
    if (!suggestions.length) return;
    
    const isMobile = inputId === 'mobile-search-input';
    const html = `
        <div id="search-suggestions" class="search-suggestions ${isMobile ? 'mobile-suggestions' : ''}">
            <div class="list-group">
                ${suggestions.map(project => `
                    <a href="#" class="list-group-item list-group-item-action" 
                       onclick="selectSuggestion(${allProjects.indexOf(project)}, '${inputId}'); return false;">
                        <div>
                            <strong>${project.name}</strong>
                            <span class="badge float-end" style="background-color: ${getStatusColor(project.status)}">${project.status}</span>
                        </div>
                        <small class="text-muted">ID: ${project.boma_id} • ${project.units} units</small>
                    </a>
                `).join('')}
            </div>
        </div>
    `;
    
    $(`#${inputId}`).closest('form').append(html);
}

/**
 * Hide search suggestions
 */
function hideSearchSuggestions() {
    $('#search-suggestions').fadeOut(200, function() { $(this).remove(); });
}

/**
 * Handle suggestion selection
 */
function selectSuggestion(index, inputId) {
    const project = allProjects[index];
    $(`#${inputId}`).val(project.name);
    hideSearchSuggestions();
    
    if (typeof showProjectInSidebar === 'function') {
        showProjectInSidebar(index);
    }
    if (typeof focusOnProject === 'function') {
        focusOnProject(index);
    }
}

/**
 * Global search function
 */
window.performSearch = function(query, source = 'desktop') {
    const inputId = source === 'mobile' ? 'mobile-search-input' : 'search-input';
    let searchQuery = typeof query === 'string' ? query.trim().toLowerCase() : '';
    
    if (!searchQuery) {
        const input = $(`#${inputId}`);
        searchQuery = input.val().trim().toLowerCase();
        if (!searchQuery) {
            showToast('Please enter a project name to search.', 'error');
            return;
        }
    }

    const project = allProjects.find(p => 
        p.name.toLowerCase().includes(searchQuery) ||
        p.boma_id.toLowerCase().includes(searchQuery)
    );

    if (project) {
        const index = allProjects.indexOf(project);
        if (typeof showProjectInSidebar === 'function') showProjectInSidebar(index);
        if (typeof focusOnProject === 'function') focusOnProject(index);
        hideSearchSuggestions();
        showToast(`Found: ${project.name}`, 'success');
    } else {
        showToast('Project not found. Try another search term.', 'error');
    }
};

/**
 * Get color based on project status
 */
function getStatusColor(status) {
    const statusColors = {
        'completed': '#198754',
        'complete': '#198754',
        'ongoing': '#ffc107',
        'nearing completion': '#fd7e14',
        'planned': '#6c757d'
    };
    return statusColors[status.toLowerCase()] || '#2b5f8e';
}