# Kitui Housing Program - Next.js Frontend

A modern, responsive Next.js 15 frontend for the Kitui Housing Program. This application provides an interactive map-based interface for exploring housing projects across Kitui County.

## Features

- **Interactive Map**: Leaflet-based map with 6 basemap options (OpenStreetMap, Satellite, Terrain, Dark, Light, Watercolor)
- **Project Search & Filtering**: Real-time search by project name or Boma ID
- **Favorites System**: Save and manage favorite projects (localStorage)
- **Responsive Design**: Mobile-first approach with full responsiveness
- **Admin Dashboard**: Comprehensive user and project management
- **Statistics & Analytics**: Project data visualization and insights
- **Contact Form**: Email integration for user inquiries
- **Performance Optimized**: Code splitting, image optimization, caching strategies

## Tech Stack

- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Mapping**: Leaflet + react-leaflet
- **Form Handling**: react-hook-form + zod validation
- **HTTP Client**: Axios
- **UI Components**: Custom shadcn/ui inspired components
- **Authentication**: NextAuth (configured for integration)

## Getting Started

### Prerequisites

- Node.js 18+ and npm/yarn/pnpm
- Flask backend running on `http://localhost:5000`

### Installation

```bash
# Install dependencies
npm install
# or
pnpm install

# Create .env.local file
cp .env.local.example .env.local

# Update .env.local with your configuration
# NEXT_PUBLIC_API_URL=http://localhost:5000
# NEXTAUTH_SECRET=your-secret-key
# NEXTAUTH_URL=http://localhost:3000
```

### Development

```bash
npm run dev
# or
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production Build

```bash
npm run build
npm start
# or
pnpm build
pnpm start
```

## Project Structure

```
├── app/
│   ├── layout.tsx              # Root layout with metadata
│   ├── globals.css             # Global styles
│   ├── page.tsx                # Home page
│   ├── dashboard/
│   │   └── page.tsx            # Interactive map dashboard
│   ├── stats/
│   │   └── page.tsx            # Statistics and analytics
│   ├── about/
│   │   └── page.tsx            # About page
│   ├── contact/
│   │   └── page.tsx            # Contact form
│   └── admin/
│       └── page.tsx            # Admin panel
├── components/
│   ├── header.tsx              # Navigation header
│   ├── footer.tsx              # Footer
│   ├── map-component.tsx       # Leaflet map with controls
│   └── ui/
│       ├── button.tsx          # Button component
│       ├── card.tsx            # Card component
│       ├── input.tsx           # Input field
│       └── textarea.tsx        # Textarea field
├── lib/
│   ├── utils.ts                # Utility functions
│   ├── api-client.ts           # Axios API client
│   └── session-provider.tsx    # NextAuth provider
├── types/
│   └── index.ts                # TypeScript type definitions
├── public/
│   ├── favicon.ico
│   ├── manifest.json
│   └── apple-touch-icon.png
├── package.json
├── tsconfig.json
├── next.config.mjs
├── tailwind.config.ts
└── postcss.config.js
```

## Key Components

### MapComponent (`components/map-component.tsx`)

The heart of the dashboard. Features include:

- **Leaflet Map**: Full-featured map centered on Kitui County (-1.374, 38.010)
- **Markers**: Color-coded by project status (Green: Completed, Orange: Ongoing, Yellow: Nearing, Gray: Planned)
- **Popups**: Click markers to view project details
- **Basemap Switcher**: Toggle between 6 different map styles (persists in localStorage)
- **Responsive**: Adapts to all screen sizes
- **Performance**: Memoized and optimized rendering

### Dashboard Page (`app/dashboard/page.tsx`)

- Sidebar with search, favorites, and project details
- Full-height map integration
- Mobile-responsive layout with hamburger menu
- Real-time project filtering
- Project selection and details panel

### Admin Panel (`app/admin/page.tsx`)

- User management with CRUD operations
- Project management with full details
- Statistics overview
- Status indicators and management tools
- Responsive table design

## API Integration

### Backend Requirements

The Flask backend must provide these endpoints:

```
GET    /api/projects              - Get all projects
POST   /login                      - Login endpoint
POST   /signup                     - User signup
POST   /contact                    - Contact form
POST   /forgot-password            - Password reset
GET    /api/admin/users           - Get all users (admin only)
POST   /api/admin/users           - Create user (admin only)
PUT    /api/admin/users/<id>      - Update user (admin only)
DELETE /api/admin/users/<id>      - Delete user (admin only)
GET    /api/admin/stats           - Admin statistics (admin only)
```

### API Client (`lib/api-client.ts`)

Pre-configured Axios client with automatic CSRF token handling, credential inclusion for cookies, and error interceptors.

## Data Models

### Project
```typescript
{
  name: string
  boma_id: string
  lat: number
  lon: number
  status: 'completed' | 'ongoing' | 'nearing completion' | 'planned'
  units: number
  unit_types?: string
  price_start?: number
  description: string
  image?: string
}
```

## Responsive Design

- **Mobile** (< 768px): Full-width maps, sidebar as drawer, hamburger menu
- **Tablet** (768-1024px): Flexible sidebar, partial width
- **Desktop** (> 1024px): Fixed sidebar (25% width), map (75% width)

## Environment Variables

```env
NEXT_PUBLIC_API_URL=http://localhost:5000
NEXTAUTH_SECRET=your-secret-key-change-in-production
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXTAUTH_URL=http://localhost:3000
```

## Deployment

### Vercel (Recommended)

```bash
git push origin main
vercel
```

Set environment variables in Vercel dashboard under Settings > Environment Variables.

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

## Support

For issues and questions:
- Email: support@kituihousing.com
- GitHub Issues: [project repository]

## License

Licensed under the MIT License - see LICENSE file for details

---

**Built with Next.js for Kitui County**
