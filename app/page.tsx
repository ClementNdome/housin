import { Header } from '@/components/header'
import { Footer } from '@/components/footer'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import Link from 'next/link'
import { MapPin, TrendingUp, Users, Home } from 'lucide-react'

export default function HomePage() {
  const stats = [
    { label: 'Active Projects', value: '145+', icon: Home },
    { label: 'Housing Units', value: '12,500+', icon: Users },
    { label: 'Completed', value: '45+', icon: TrendingUp },
  ]

  const features = [
    {
      icon: MapPin,
      title: 'Interactive Map',
      description: 'Explore all housing projects on an interactive map with detailed information and location markers.',
    },
    {
      icon: Home,
      title: 'Project Details',
      description: 'Get comprehensive information about each project including units, pricing, status, and amenities.',
    },
    {
      icon: Users,
      title: 'Save Favorites',
      description: 'Bookmark your favorite projects and access them instantly from any device.',
    },
    {
      icon: TrendingUp,
      title: 'Statistics & Insights',
      description: 'View comprehensive statistics and trends about housing developments in Kitui County.',
    },
  ]

  return (
    <div className="flex flex-col min-h-screen bg-white">
      <Header />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden bg-gradient-to-br from-primary/90 to-primary-dark py-12 md:py-20">
          <div className="max-w-7xl mx-auto px-4 md:px-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 items-center">
              <div>
                <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 leading-tight text-balance">
                  Discover Your Dream Home in Kitui
                </h1>
                <p className="text-lg text-white/90 mb-8 leading-relaxed max-w-xl">
                  Explore comprehensive housing projects across Kitui County. Find the perfect property with our interactive map, detailed project information, and expert guidance.
                </p>
                <div className="flex flex-col sm:flex-row gap-4">
                  <Link href="/dashboard">
                    <Button variant="secondary" size="lg" className="w-full sm:w-auto">
                      Explore Projects
                    </Button>
                  </Link>
                  <Link href="/contact">
                    <Button variant="outline" size="lg" className="w-full sm:w-auto border-white text-white hover:bg-white/10">
                      Get In Touch
                    </Button>
                  </Link>
                </div>
              </div>

              {/* Hero Stats */}
              <div className="grid grid-cols-1 gap-4">
                {stats.map((stat) => {
                  const Icon = stat.icon
                  return (
                    <Card key={stat.label} className="bg-white/95 backdrop-blur border-0">
                      <CardContent className="p-6 flex items-start gap-4">
                        <div className="p-3 bg-primary/10 rounded-lg">
                          <Icon className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm text-gray-600 font-medium">{stat.label}</p>
                          <p className="text-2xl md:text-3xl font-bold text-primary">{stat.value}</p>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-12 md:py-20 px-4 md:px-6">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4 text-balance">
                Why Choose Our Platform
              </h2>
              <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                We provide the most comprehensive and up-to-date information about housing projects in Kitui County.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {features.map((feature) => {
                const Icon = feature.icon
                return (
                  <Card key={feature.title} className="hover:shadow-lg transition-shadow">
                    <CardContent className="p-6">
                      <div className="p-3 bg-primary/10 rounded-lg w-fit mb-4">
                        <Icon className="w-6 h-6 text-primary" />
                      </div>
                      <h3 className="text-xl font-bold text-foreground mb-2">{feature.title}</h3>
                      <p className="text-gray-600">{feature.description}</p>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="bg-primary text-white py-12 md:py-16">
          <div className="max-w-4xl mx-auto text-center px-4">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-balance">
              Ready to Find Your Perfect Home?
            </h2>
            <p className="text-lg text-white/90 mb-8 max-w-2xl mx-auto">
              Start exploring our interactive map today and discover amazing housing opportunities in Kitui County.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/dashboard">
                <Button variant="secondary" size="lg" className="w-full sm:w-auto">
                  Start Exploring
                </Button>
              </Link>
              <Link href="/stats">
                <Button variant="outline" size="lg" className="w-full sm:w-auto border-white text-white hover:bg-white/10">
                  View Statistics
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
