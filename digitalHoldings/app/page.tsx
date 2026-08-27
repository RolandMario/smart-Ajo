'use client'

import Link from 'next/link'
import {
  Mail, ArrowRight, Shield, Code, Smartphone, Layout, RefreshCw, CheckCircle, Layers, Heart, Users,
} from 'lucide-react'
import NavBar from './components/navBar'
import Footer from './components/footer'

export default function Home() {
  return (
    <main className="min-h-screen bg-ajo-canvas">
      {/* Header */}
      <NavBar />

      {/* Hero Section */}
      <section id="top" className="bg-white">
        <div className="mx-auto grid min-h-[calc(100vh-108px)] max-w-7xl items-center gap-12 px-4 py-10 sm:px-6 sm:py-14 lg:grid-cols-2 lg:px-8 lg:py-16">
          <div className="max-w-3xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-ajo-line bg-white px-3 py-2 text-sm font-extrabold text-ajo-inkSoft shadow-sm">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-ajo-accent text-ajo-ink">
                <Layers className="h-4 w-4" />
              </span>
              Digital Smart Environment
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-ajo-ink leading-tight">
              We design, develop & deliver innovative digital solutions.
            </h1>
            <p className="mt-6 text-lg md:text-xl text-ajo-inkSoft leading-relaxed">
              From custom software and mobile/web applications to responsive website design and the digital
              transformation of IT services, we build technology that moves your business forward.
            </p>

            <div className="mt-8 flex flex-wrap gap-4">
              <a href="#services" className="btn-primary">
                Explore Our Services
                <ArrowRight className="h-5 w-5" />
              </a>
              <a href="#projects" className="btn-outline">
                See Our Work
              </a>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <div className="flex items-start gap-2">
                <CheckCircle className="h-5 w-5 text-ajo-success mt-0.5" />
                <div>
                  <strong className="block text-sm text-ajo-ink">End-to-End</strong>
                  <span className="text-xs text-ajo-inkSoft">Design to delivery</span>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="h-5 w-5 text-ajo-success mt-0.5" />
                <div>
                  <strong className="block text-sm text-ajo-ink">Innovative</strong>
                  <span className="text-xs text-ajo-inkSoft">Modern solutions</span>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="h-5 w-5 text-ajo-success mt-0.5" />
                <div>
                  <strong className="block text-sm text-ajo-ink">Proven</strong>
                  <span className="text-xs text-ajo-inkSoft">Built & shipped products</span>
                </div>
              </div>
            </div>
          </div>

          <div className="relative flex justify-center lg:justify-end">
            <div className="relative">
              <div className="rounded-card bg-ajo-primary p-4 shadow-soft">
                <div className="relative overflow-hidden rounded-card bg-ajo-surfaceSunken">
                  <div className="flex h-[400px] w-full items-center justify-center">
                    <Code className="h-32 w-32 text-ajo-primary" />
                  </div>
                </div>
              </div>

              <div className="absolute -bottom-4 -left-4 rounded-card bg-white p-4 shadow-lg">
                <div className="flex items-center gap-3">
                  <div className="grid h-12 w-12 place-items-center rounded-full bg-ajo-success">
                    <Shield className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <strong className="block text-sm text-ajo-ink">Quality Assured</strong>
                    <span className="text-xs text-ajo-inkSoft">Reliable & secure builds</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="bg-ajo-canvas">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-2 lg:px-8 lg:py-28">
          <div>
            <p className="eyebrow">About Us</p>
            <h2 className="section-title">
              A forward-thinking technology company.
            </h2>
          </div>
          <div className="flex items-center">
            <p className="section-copy">
              Digital Smart Environment specializes in the design, development, and delivery of innovative digital
              solutions. We provide end-to-end services in custom software development, mobile and web application
              creation, responsive website design, and digital transformation of IT services. Ajo — a digital savings
              platform — is one of the projects executed by Digital Smart Environment.
            </p>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section id="services" className="bg-white">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-28">
          <div className="max-w-3xl">
            <p className="eyebrow">Our Services</p>
            <h2 className="section-title">
              What we do for your business.
            </h2>
          </div>

          <div className="mt-12 grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            {/* Service 1 */}
            <div className="rounded-card border border-ajo-line bg-white p-6 transition hover:shadow-lg">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-ajo-primarySoft">
                <Code className="h-6 w-6 text-ajo-primary" />
              </div>
              <p className="text-sm font-semibold text-ajo-primary mb-2">Development</p>
              <h3 className="text-xl font-bold text-ajo-ink mb-3">Custom Software Development</h3>
              <p className="text-ajo-inkSoft">
                Tailored software designed around your workflows — scalable, secure, and built to grow with you.
              </p>
            </div>

            {/* Service 2 */}
            <div className="rounded-card border border-ajo-line bg-white p-6 transition hover:shadow-lg">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-ajo-primarySoft">
                <Smartphone className="h-6 w-6 text-ajo-primary" />
              </div>
              <p className="text-sm font-semibold text-ajo-primary mb-2">Apps</p>
              <h3 className="text-xl font-bold text-ajo-ink mb-3">Mobile & Web Applications</h3>
              <p className="text-ajo-inkSoft">
                Intuitive mobile and web apps that deliver rich experiences on iOS, Android, and the modern web.
              </p>
            </div>

            {/* Service 3 */}
            <div className="rounded-card border border-ajo-line bg-white p-6 transition hover:shadow-lg">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-ajo-primarySoft">
                <Layout className="h-6 w-6 text-ajo-primary" />
              </div>
              <p className="text-sm font-semibold text-ajo-primary mb-2">Design</p>
              <h3 className="text-xl font-bold text-ajo-ink mb-3">Responsive Website Design</h3>
              <p className="text-ajo-inkSoft">
                Beautiful, accessible, responsive websites that look and perform great on every device.
              </p>
            </div>

            {/* Service 4 */}
            <div className="rounded-card border border-ajo-line bg-white p-6 transition hover:shadow-lg">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-ajo-primarySoft">
                <RefreshCw className="h-6 w-6 text-ajo-primary" />
              </div>
              <p className="text-sm font-semibold text-ajo-primary mb-2">Transformation</p>
              <h3 className="text-xl font-bold text-ajo-ink mb-3">Digital Transformation of IT</h3>
              <p className="text-ajo-inkSoft">
                Modernize legacy systems and processes to unlock new efficiencies and digital capabilities.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Projects Section */}
      <section id="projects" className="bg-ajo-surfaceSunken">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-28">
          <div className="text-center max-w-3xl mx-auto">
            <p className="eyebrow">Our Work</p>
            <h2 className="section-title mx-auto">
              Projects we've delivered.
            </h2>
            <p className="mt-4 section-copy">
              Digital Smart Environment partners with clients to bring ambitious products to life. Here is one of our
              projects — more on the way.
            </p>
          </div>

          <div className="mt-12 grid gap-8 lg:grid-cols-2">
            {/* Ajo featured project */}
            <Link
              href="/projects/ajo"
              className="rounded-card overflow-hidden border border-ajo-line bg-white shadow-sm transition hover:shadow-lg"
            >
              <div className="flex h-48 items-center justify-center bg-ajo-primary">
                <span className="text-6xl font-bold text-white">A</span>
              </div>
              <div className="p-6">
                <p className="text-sm font-semibold text-ajo-primary mb-1">Flagship Project · Digital Savings</p>
                <h3 className="text-2xl font-bold text-ajo-ink mb-2">Ajo</h3>
                <p className="text-ajo-inkSoft mb-4">
                  A modern digital savings platform for creating and joining savings groups, automating contributions,
                  and receiving rotating payouts — save together, thrive together.
                </p>
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-ajo-primary">
                  View Project <ArrowRight className="h-4 w-4" />
                </span>
              </div>
            </Link>

            {/* Upcoming projects placeholder */}
            <div className="rounded-card border-2 border-dashed border-ajo-line bg-white p-6">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-ajo-accentSoft">
                <Layers className="h-6 w-6 text-ajo-accent" />
              </div>
              <h3 className="text-xl font-bold text-ajo-ink mb-3">Your project could be next</h3>
              <p className="text-ajo-inkSoft mb-4">
                Have an idea? From concept to launch, our team can design, develop, and deliver the solution your
                business needs.
              </p>
              <a href="/contact" className="btn-primary">
                Start a Project
                <ArrowRight className="h-5 w-5" />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Why Choose Us Section */}
      <section id="why-us" className="bg-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-2 lg:px-8 lg:py-28">
          <div>
            <p className="eyebrow">Why Choose Us</p>
            <h2 className="section-title">
              Built on expertise and delivery.
            </h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-card border border-ajo-line bg-white p-6">
              <Shield className="h-6 w-6 text-ajo-primary mb-3" />
              <h3 className="text-lg font-bold text-ajo-ink mb-2">End-to-End Delivery</h3>
              <p className="text-sm text-ajo-inkSoft">From design to deployment, we handle the full lifecycle</p>
            </div>

            <div className="rounded-card border border-ajo-line bg-white p-6">
              <Users className="h-6 w-6 text-ajo-primary mb-3" />
              <h3 className="text-lg font-bold text-ajo-ink mb-2">Client Focused</h3>
              <p className="text-sm text-ajo-inkSoft">Solutions shaped around your goals, not ours</p>
            </div>

            <div className="rounded-card border border-ajo-line bg-white p-6">
              <RefreshCw className="h-6 w-6 text-ajo-primary mb-3" />
              <h3 className="text-lg font-bold text-ajo-ink mb-2">Modern Technology</h3>
              <p className="text-sm text-ajo-inkSoft">Built with current, scalable, secure tools and practices</p>
            </div>

            <div className="rounded-card border border-ajo-line bg-white p-6">
              <Heart className="h-6 w-6 text-ajo-primary mb-3" />
              <h3 className="text-lg font-bold text-ajo-ink mb-2">Detail Oriented</h3>
              <p className="text-sm text-ajo-inkSoft">Quality and precision in every layer of what we ship</p>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="bg-ajo-primary px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-28">
        <div className="mx-auto max-w-7xl">
          <div className="text-center mb-12">
            <p className="eyebrow text-ajo-accent">Testimonials</p>
            <h2 className="text-3xl md:text-4xl font-bold text-white">What our clients say</h2>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            <div className="rounded-card bg-white p-6">
              <p className="text-ajo-ink mb-4">"Digital Smart Environment took our idea and turned it into a polished, production-ready platform. Their team is responsive and truly understands product delivery."</p>
              <strong className="text-ajo-ink">Mrs Deborah Labija.</strong>
              <p className="text-sm text-ajo-inkSoft">Founder, Fintech Startup</p>
            </div>

            <div className="rounded-card bg-white p-6">
              <p className="text-ajo-ink mb-4">"From the web app to the mobile experience, everything was delivered on time and exceeded our expectations. Highly recommended."</p>
              <strong className="text-ajo-ink">Mr Kennie.</strong>
              <p className="text-sm text-ajo-inkSoft">Operations Lead</p>
            </div>

            <div className="rounded-card bg-white p-6">
              <p className="text-ajo-ink mb-4">"They modernized our legacy systems and the impact was immediate. A great partner for digital transformation."</p>
              <strong className="text-ajo-ink">Julius Edicha.</strong>
              <p className="text-sm text-ajo-inkSoft">IT Director</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section id="contact" className="bg-ajo-ink px-4 py-16 text-center text-white sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <p className="eyebrow text-ajo-accent">Ready to Build?</p>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mx-auto max-w-3xl">
            Let's create something great together
          </h2>
          <div className="mx-auto mt-8 flex flex-wrap justify-center gap-4">
            <a href="/contact" className="btn-primary">
              <Mail className="h-5 w-5" />
              Start a Project
            </a>
            <a href="mailto:hello@digitalsmartenvironment.com" className="btn-secondary">
              <Mail className="h-5 w-5" />
              Contact Us
            </a>
          </div>
        </div>
      </section>
      <Footer />
    </main>
  )
}

