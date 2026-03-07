import { Header } from '@/components/header'
import { Footer } from '@/components/footer'
import { Card, CardContent } from '@/components/ui/card'

export default function AboutPage() {
  return (
    <div className="flex flex-col min-h-screen bg-white">
      <Header />

      <main className="flex-1">
        {/* Hero */}
        <section className="bg-primary text-white py-12 md:py-16 px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-4 text-balance">About Kitui Housing Program</h1>
            <p className="text-lg text-white/90">
              Connecting People with Quality Housing Opportunities Across Kitui County
            </p>
          </div>
        </section>

        {/* Mission & Vision */}
        <section className="py-12 md:py-20 px-4 md:px-6">
          <div className="max-w-4xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
              <Card>
                <CardContent className="p-8">
                  <h2 className="text-2xl font-bold text-primary mb-4">Our Mission</h2>
                  <p className="text-gray-700 leading-relaxed">
                    To provide transparent, comprehensive, and accessible information about housing projects across Kitui County, empowering residents and investors to make informed decisions about their housing needs and investments.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-8">
                  <h2 className="text-2xl font-bold text-primary mb-4">Our Vision</h2>
                  <p className="text-gray-700 leading-relaxed">
                    To be the leading platform for housing information in Kitui County, facilitating sustainable development and improving the quality of life for all residents through quality housing solutions.
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="prose prose-lg max-w-none text-gray-700">
              <h2 className="text-3xl font-bold text-foreground mb-6">About Us</h2>
              <p className="mb-4 leading-relaxed">
                Kitui Housing Program is a comprehensive platform dedicated to showcasing and managing housing projects throughout Kitui County. We believe that access to quality housing is a fundamental right, and our mission is to make it easier for everyone to find their perfect home.
              </p>

              <h3 className="text-2xl font-bold text-foreground mt-8 mb-4">What We Offer</h3>
              <ul className="space-y-3 mb-6">
                <li className="flex gap-3">
                  <span className="text-primary font-bold">•</span>
                  <span><strong>Interactive Mapping:</strong> Explore all housing projects on an interactive map with detailed location information</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-primary font-bold">•</span>
                  <span><strong>Comprehensive Project Details:</strong> Access complete information about each project including units, pricing, amenities, and status</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-primary font-bold">•</span>
                  <span><strong>Personalized Experience:</strong> Save your favorite projects and access them anytime for quick reference</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-primary font-bold">•</span>
                  <span><strong>Market Insights:</strong> View statistics and trends about housing developments in the region</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-primary font-bold">•</span>
                  <span><strong>Expert Support:</strong> Get in touch with our team for personalized assistance</span>
                </li>
              </ul>

              <h3 className="text-2xl font-bold text-foreground mt-8 mb-4">Why Choose Us</h3>
              <p className="mb-4 leading-relaxed">
                With years of experience in the housing sector, we understand the needs of both homebuyers and investors. Our platform combines cutting-edge technology with local expertise to provide you with the most accurate and up-to-date information about housing opportunities in Kitui County.
              </p>

              <p className="mb-4 leading-relaxed">
                Whether you're looking for your first home, an investment property, or exploring market trends, we're here to guide you every step of the way.
              </p>
            </div>
          </div>
        </section>

        {/* Team or Values */}
        <section className="bg-gray-50 py-12 md:py-20 px-4 md:px-6">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-foreground mb-8 text-center">Our Core Values</h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                {
                  title: 'Transparency',
                  description: 'We believe in providing complete and honest information about all housing projects.',
                },
                {
                  title: 'Accessibility',
                  description: 'Our platform is designed to be user-friendly and accessible to everyone regardless of technical expertise.',
                },
                {
                  title: 'Reliability',
                  description: 'We maintain the highest standards of accuracy and reliability in all our information.',
                },
                {
                  title: 'Innovation',
                  description: 'We continuously improve our platform with the latest technology and features.',
                },
                {
                  title: 'Customer Focus',
                  description: 'Your satisfaction and success is our top priority in everything we do.',
                },
                {
                  title: 'Sustainability',
                  description: 'We promote sustainable housing solutions that benefit both people and the environment.',
                },
              ].map((value) => (
                <Card key={value.title} className="hover:shadow-lg transition-shadow">
                  <CardContent className="p-6">
                    <h3 className="text-lg font-bold text-primary mb-2">{value.title}</h3>
                    <p className="text-gray-600 text-sm">{value.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
