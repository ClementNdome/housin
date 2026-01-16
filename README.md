# Kitui Housing Dashboard

A comprehensive web application for visualizing affordable housing projects in Kitui County, Kenya. This interactive dashboard allows users to explore housing projects on a map, search for specific developments, view detailed statistics, and access project information.

## Features

- 🗺️ **Interactive Map**: Explore housing projects on an interactive map powered by Leaflet.js and OpenStreetMap
- 🔍 **Smart Search**: Find projects quickly with autocomplete search functionality
- 📊 **Statistics Dashboard**: View aggregated data and visualizations of housing projects
- 📝 **Detailed Information**: Access comprehensive project details including status, units, pricing, and amenities
- ⭐ **Favorites**: Save your preferred projects for quick access (stored in browser localStorage)
- 📱 **Responsive Design**: Access the dashboard on any device with a mobile-first approach
- 🔐 **Admin Panel**: Manage projects with a simple CRUD interface (password-protected)

## Tech Stack

- **Backend**: Flask (Python)
- **Frontend**: HTML5, CSS3, JavaScript
- **Maps**: Leaflet.js with OpenStreetMap
- **UI Framework**: Bootstrap 5
- **Charts**: Chart.js
- **Data Storage**: JSON file (easily migratable to database)

## Installation

### Prerequisites

- Python 3.7 or higher
- pip (Python package manager)

### Setup Steps

1. **Clone or download this repository**

2. **Create a virtual environment** (recommended):
   ```bash
   python -m venv venv
   ```

3. **Activate the virtual environment**:
   - On Windows:
     ```bash
     venv\Scripts\activate
     ```
   - On macOS/Linux:
     ```bash
     source venv/bin/activate
     ```

4. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

5. **Run the application**:
   ```bash
   python app.py
   ```
   Or using Flask CLI:
   ```bash
   flask run
   ```

6. **Open your browser** and navigate to:
   ```
   http://localhost:5000
   ```

## Project Structure

```
kitui-housing-prototype/
├── app.py                 # Main Flask application
├── projects.json          # Project data (JSON format)
├── requirements.txt       # Python dependencies
├── README.md             # This file
├── templates/            # Jinja2 HTML templates
│   ├── base.html         # Base layout template
│   ├── dashboard.html    # Main dashboard page
│   ├── about.html        # About page
│   ├── stats.html        # Statistics page
│   ├── contact.html      # Contact form page
│   ├── admin.html        # Admin panel
│   └── 404.html          # 404 error page
└── static/               # Static assets
    ├── css/
    │   └── style.css     # Custom styles
    ├── js/
    │   ├── map.js        # Map functionality
    │   ├── search.js     # Search and autocomplete
    │   └── stats.js      # Statistics charts
    └── img/              # Image assets
```

## Usage

### Dashboard

The main dashboard displays an interactive map with markers for each housing project. Click on a marker to view project details in a popup, or use the search bar to find specific projects.

### Search

Type a project name in the search bar. The autocomplete feature will suggest matching projects as you type. Click "Search" or press Enter to navigate to the project on the map.

### Statistics

Visit the Statistics page to view:
- Total number of projects and units
- Projects by status (pie chart)
- Units distribution (bar chart)
- Detailed project table

### Admin Panel

Access the admin panel at `/admin` to:
- Add new projects
- Edit existing projects
- Delete projects

**Default password**: `admin123` (change this in production!)

## Data Format

Projects are stored in `projects.json` with the following structure:

```json
{
  "boma_id": "78",
  "name": "Project Name",
  "status": "ongoing",
  "units": 500,
  "image": "https://example.com/image.jpg",
  "lat": -1.374,
  "lon": 38.010,
  "description": "Project description",
  "unit_types": "Studio, 1-3 Bedroom",
  "price_start": 640000
}
```

## Development

### Adding New Projects

1. Edit `projects.json` directly, or
2. Use the Admin Panel at `/admin`

### Customization

- **Styling**: Modify `static/css/style.css`
- **Map Settings**: Adjust in `static/js/map.js`
- **Routes**: Add new routes in `app.py`

## Future Enhancements

- Database integration (SQLite/PostgreSQL)
- User authentication (Flask-Login)
- Email notifications (Flask-Mail)
- Image upload functionality
- Export to CSV/PDF
- Real-time data updates
- API endpoints for external access

## Security Notes

⚠️ **Important**: This is a prototype application. For production use:

- Change the admin password in `app.py`
- Implement proper authentication (Flask-Login)
- Use environment variables for sensitive data
- Add input validation and sanitization
- Implement CSRF protection
- Use HTTPS
- Add rate limiting

## License

This project is open source and available for educational and development purposes.

## Acknowledgments

- Inspired by the Boma Yangu platform
- Uses OpenStreetMap for map data
- Built with Flask, Leaflet.js, and Bootstrap

## Support

For questions or feedback, use the Contact form in the application or open an issue in the repository.

---

**Built with ❤️ for Kitui County**
