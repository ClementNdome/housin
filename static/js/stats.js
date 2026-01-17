// Statistics page functionality
let projectsData = [];

$(document).ready(function() {
    // Load projects data
    $.get('/api/projects', function(data) {
        projectsData = data;
        calculateStats();
        renderCharts();
        renderTable();
    });
});

function calculateStats() {
    const totalProjects = projectsData.length;
    const totalUnits = projectsData.reduce((sum, p) => sum + (p.units || 0), 0);
    
    const statusCounts = {};
    projectsData.forEach(p => {
        statusCounts[p.status] = (statusCounts[p.status] || 0) + 1;
    });
    
    const ongoingCount = statusCounts['ongoing'] || 0;
    const completedCount = (statusCounts['completed'] || 0) + (statusCounts['complete'] || 0);
    
    // Update stats cards
    $('#total-projects').text(totalProjects);
    $('#total-units').text(totalUnits.toLocaleString());
    $('#ongoing-count').text(ongoingCount);
    $('#completed-count').text(completedCount);
}

function renderCharts() {
    // Status Chart (Pie)
    const statusCounts = {};
    projectsData.forEach(p => {
        statusCounts[p.status] = (statusCounts[p.status] || 0) + 1;
    });
    
    const statusCtx = document.getElementById('statusChart').getContext('2d');
    new Chart(statusCtx, {
        type: 'pie',
        data: {
            labels: Object.keys(statusCounts),
            datasets: [{
                data: Object.values(statusCounts),
                backgroundColor: [
                    'rgba(54, 162, 235, 0.8)',
                    'rgba(255, 99, 132, 0.8)',
                    'rgba(255, 206, 86, 0.8)',
                    'rgba(75, 192, 192, 0.8)',
                    'rgba(153, 102, 255, 0.8)'
                ]
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });

    // Units Distribution (Bar Chart)
    const unitsCtx = document.getElementById('unitsChart').getContext('2d');
    new Chart(unitsCtx, {
        type: 'bar',
        data: {
            labels: projectsData.map(p => p.name.length > 20 ? p.name.substring(0, 20) + '...' : p.name),
            datasets: [{
                label: 'Number of Units',
                data: projectsData.map(p => p.units || 0),
                backgroundColor: 'rgba(75, 192, 192, 0.8)',
                borderColor: 'rgba(75, 192, 192, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true
                }
            },
            plugins: {
                legend: {
                    display: false
                }
            }
        }
    });
}

function renderTable() {
    const tbody = $('#projects-table tbody');
    tbody.empty();
    
    projectsData.forEach(project => {
        const row = `
            <tr>
                <td>${project.name}</td>
                <td><span class="badge bg-secondary">${project.status}</span></td>
                <td>${(project.units || 0).toLocaleString()}</td>
                <td>${project.price_start ? 'KES ' + project.price_start.toLocaleString() : 'N/A'}</td>
                <td>${project.lat.toFixed(4)}, ${project.lon.toFixed(4)}</td>
            </tr>
        `;
        tbody.append(row);
    });
}
