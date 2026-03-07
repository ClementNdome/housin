'use client'

import { useState, FormEvent } from 'react'
import { Header } from '@/components/header'
import { Footer } from '@/components/footer'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { apiClient } from '@/lib/api-client'
import { Mail, Phone, MapPin } from 'lucide-react'

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    message: '',
  })
  const [isLoading, setIsLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      await apiClient.submitContact(formData)
      setSubmitted(true)
      setFormData({ name: '', email: '', message: '' })
      setTimeout(() => setSubmitted(false), 5000)
    } catch (err) {
      console.error('[v0] Error submitting contact form:', err)
      setError('Failed to send message. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-white">
      <Header />

      <main className="flex-1">
        {/* Hero */}
        <section className="bg-primary text-white py-12 md:py-16 px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-4 text-balance">Get In Touch</h1>
            <p className="text-lg text-white/90">
              Have questions? We'd love to hear from you. Send us a message and we'll respond as soon as possible.
            </p>
          </div>
        </section>

        {/* Contact Content */}
        <section className="py-12 md:py-20 px-4 md:px-6">
          <div className="max-w-5xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
              {[
                {
                  icon: Mail,
                  title: 'Email',
                  content: 'info@kituihousing.com',
                  href: 'mailto:info@kituihousing.com',
                },
                {
                  icon: Phone,
                  title: 'Phone',
                  content: '+254 (123) 456-789',
                  href: 'tel:+254123456789',
                },
                {
                  icon: MapPin,
                  title: 'Location',
                  content: 'Kitui, Kenya',
                  href: '#',
                },
              ].map(({ icon: Icon, title, content, href }) => (
                <Card key={title} className="hover:shadow-lg transition-shadow">
                  <CardContent className="p-6 text-center">
                    <div className="p-3 bg-primary/10 rounded-lg w-fit mx-auto mb-4">
                      <Icon className="w-6 h-6 text-primary" />
                    </div>
                    <h3 className="font-bold text-lg mb-2">{title}</h3>
                    {href && href !== '#' ? (
                      <a href={href} className="text-primary hover:underline">
                        {content}
                      </a>
                    ) : (
                      <p className="text-gray-600">{content}</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Contact Form */}
            <Card className="max-w-2xl mx-auto">
              <CardHeader>
                <CardTitle>Send us a Message</CardTitle>
              </CardHeader>
              <CardContent>
                {submitted ? (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                    <p className="text-green-800 font-medium">
                      Thank you for your message! We'll get back to you soon.
                    </p>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-6">
                    {error && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                        <p className="text-red-800 text-sm">{error}</p>
                      </div>
                    )}

                    <Input
                      label="Full Name"
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      placeholder="John Doe"
                      required
                      minLength={2}
                    />

                    <Input
                      label="Email Address"
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      placeholder="john@example.com"
                      required
                    />

                    <Textarea
                      label="Message"
                      name="message"
                      value={formData.message}
                      onChange={handleChange}
                      placeholder="Tell us how we can help..."
                      rows={6}
                      required
                      minLength={10}
                    />

                    <Button
                      type="submit"
                      variant="primary"
                      size="lg"
                      className="w-full"
                      disabled={isLoading}
                    >
                      {isLoading ? 'Sending...' : 'Send Message'}
                    </Button>
                  </form>
                )}
              </CardContent>
            </Card>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="bg-gray-50 py-12 md:py-20 px-4 md:px-6">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-foreground mb-8 text-center">Frequently Asked Questions</h2>

            <div className="space-y-6">
              {[
                {
                  q: 'How do I search for projects?',
                  a: 'You can use our interactive map on the Dashboard page to explore all projects. Use the search feature in the sidebar to filter by project name or Boma ID.',
                },
                {
                  q: 'Can I save my favorite projects?',
                  a: 'Yes! Click the heart icon on any project to add it to your favorites. Your favorites are saved locally on your device.',
                },
                {
                  q: 'How often is the project information updated?',
                  a: 'We update our project information regularly. For the most current details, please contact us directly.',
                },
                {
                  q: 'Is there a mobile app available?',
                  a: 'Our website is fully responsive and works great on mobile devices. You can use it just like a native app.',
                },
                {
                  q: 'Do you offer financing assistance?',
                  a: 'We provide information about projects. For financing options, please contact the individual project developers or our team.',
                },
              ].map(({ q, a }, idx) => (
                <Card key={idx}>
                  <CardContent className="p-6">
                    <h3 className="font-bold text-lg text-foreground mb-2">{q}</h3>
                    <p className="text-gray-600">{a}</p>
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
