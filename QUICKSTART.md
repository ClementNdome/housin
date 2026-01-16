# Quick Start Guide

## First Time Setup

1. **Install Python dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

2. **Run the application:**
   ```bash
   python app.py
   ```

3. **Open your browser:**
   Navigate to `http://localhost:5000`

## Key Features to Try

### Dashboard
- View all housing projects on the interactive map
- Click any marker to see project details
- Use the search bar with autocomplete to find specific projects
- Click the star icon to add projects to favorites

### Statistics Page
- View aggregated statistics about all projects
- See pie charts and bar charts visualizing the data
- Browse the detailed project table

### Admin Panel
- Navigate to `/admin`
- Login with password: `admin123`
- Add, edit, or delete projects
- All changes are saved to `projects.json`

### Other Pages
- **About**: Learn about the project and Kitui County housing context
- **Contact**: Submit feedback (prototype - shows confirmation message)
- **Statistics**: View data visualizations

## Data Management

Projects are stored in `projects.json`. You can:
- Edit the file directly (JSON format)
- Use the Admin Panel (recommended)
- The file is automatically reloaded when the app restarts

## Troubleshooting

**Map not showing?**
- Check browser console for errors
- Ensure internet connection (for OpenStreetMap tiles)

**Search not working?**
- Make sure JavaScript is enabled
- Check browser console for errors

**Admin panel not accessible?**
- Default password is `admin123`
- Check Flask session is working (cookies enabled)

## Next Steps

- Customize the styling in `static/css/style.css`
- Add more projects via Admin Panel or edit `projects.json`
- Deploy to a server (Heroku, Vercel, etc.) for production use
