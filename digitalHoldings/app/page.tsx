'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Menu, X, Download, Mail, ArrowRight, Shield, Users, Zap, Heart, CheckCircle, Smartphone } from 'lucide-react'
import NavBar from './components/navBar'

export default function Home() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <main className="min-h-screen bg-ajo-canvas">
      {/* Header */}
      <NavBar />

      {/* Hero Section */}
      <section className="bg-white">
        <div className="mx-auto grid min-h-[calc(100vh-108px)] max-w-7xl items-center gap-12 px-4 py-10 sm:px-6 sm:py-14 lg:grid-cols-2 lg:px-8 lg:py-16">
          <div className="max-w-3xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-ajo-line bg-white px-3 py-2 text-sm font-extrabold text-ajo-inkSoft shadow-sm">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-ajo-accent text-ajo-ink">
                <Heart className="h-4 w-4" />
              </span>
              Digital savings reimagined
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-ajo-ink leading-tight">
              Save Together, Thrive Together.
            </h1>
            <p className="mt-6 text-lg md:text-xl text-ajo-inkSoft leading-relaxed">
              Join or create savings groups, automate contributions, and achieve your financial goals with Ajo. The modern way to save with family, friends, and community.
            </p>

            <div className="mt-8 flex flex-wrap gap-4">
              <button className="btn-primary">
                <Download className="h-5 w-5" />
                Download App
              </button>
              <button className="btn-outline">
                Get Started
                <ArrowRight className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <div className="flex items-start gap-2">
                <CheckCircle className="h-5 w-5 text-ajo-success mt-0.5" />
                <div>
                  <strong className="block text-sm text-ajo-ink">Secure</strong>
                  <span className="text-xs text-ajo-inkSoft">Bank-level security</span>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="h-5 w-5 text-ajo-success mt-0.5" />
                <div>
                  <strong className="block text-sm text-ajo-ink">Flexible</strong>
                  <span className="text-xs text-ajo-inkSoft">Create any group</span>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="h-5 w-5 text-ajo-success mt-0.5" />
                <div>
                  <strong className="block text-sm text-ajo-ink">Transparent</strong>
                  <span className="text-xs text-ajo-inkSoft">Track all contributions</span>
                </div>
              </div>
            </div>
          </div>

          <div className="relative flex justify-center lg:justify-end">
            <div className="relative">
              <div className="rounded-card bg-ajo-primary p-4 shadow-soft">
                <div className="relative overflow-hidden rounded-card bg-ajo-surfaceSunken">
                  <div className="flex h-[400px] w-full items-center justify-center">
                    <Smartphone className="h-32 w-32 text-ajo-primary" />
                  </div>
                </div>
              </div>

              <div className="absolute -bottom-4 -left-4 rounded-card bg-white p-4 shadow-lg">
                <div className="flex items-center gap-3">
                  <div className="grid h-12 w-12 place-items-center rounded-full bg-ajo-success">
                    <Shield className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <strong className="block text-sm text-ajo-ink">Secure Payments</strong>
                    <span className="text-xs text-ajo-inkSoft">Encrypted & verified</span>
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
            <p className="eyebrow">About Ajo</p>
            <h2 className="section-title">
              Modern digital savings for everyone.
            </h2>
          </div>
          <div className="flex items-center">
            <p className="section-copy">
              Ajo is a digital platform that brings the traditional savings group experience into the modern era. Create or join savings groups with friends, family, or community members. Automate contributions, track progress, and receive payouts on schedule - all from your phone.
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
              Everything you need to save smarter.
            </h2>
          </div>

          <div className="mt-12 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {/* Service 1 */}
            <div className="rounded-card border border-ajo-line bg-white p-6 transition hover:shadow-lg">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-ajo-primarySoft">
                <Users className="h-6 w-6 text-ajo-primary" />
              </div>
              <p className="text-sm font-semibold text-ajo-primary mb-2">Group Creation</p>
              <h3 className="text-xl font-bold text-ajo-ink mb-3">Create Savings Groups</h3>
              <p className="text-ajo-inkSoft">
                Start a savings group with custom contribution amounts, frequency, and member limits. Set your rules and invite members.
              </p>
            </div>

            {/* Service 2 */}
            <div className="rounded-card border border-ajo-line bg-white p-6 transition hover:shadow-lg">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-ajo-primarySoft">
                <Zap className="h-6 w-6 text-ajo-primary" />
              </div>
              <p className="text-sm font-semibold text-ajo-primary mb-2">Automation</p>
              <h3 className="text-xl font-bold text-ajo-ink mb-3">Automated Contributions</h3>
              <p className="text-ajo-inkSoft">
                Set up automatic contributions from your wallet. Never miss a payment and stay on track with your savings goals.
              </p>
            </div>

            {/* Service 3 */}
            <div className="rounded-card border border-ajo-line bg-white p-6 transition hover:shadow-lg">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-ajo-primarySoft">
                <ArrowRight className="h-6 w-6 text-ajo-primary" />
              </div>
              <p className="text-sm font-semibold text-ajo-primary mb-2">Rotating System</p>
              <h3 className="text-xl font-bold text-ajo-ink mb-3">Rotating Payouts</h3>
              <p className="text-ajo-inkSoft">
                Members take turns receiving the collected funds. Fair, transparent, and automated rotation system ensures everyone benefits.
              </p>
            </div>

            {/* Service 4 */}
            <div className="rounded-card border border-ajo-line bg-white p-6 transition hover:shadow-lg">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-ajo-primarySoft">
                <Shield className="h-6 w-6 text-ajo-primary" />
              </div>
              <p className="text-sm font-semibold text-ajo-primary mb-2">Security</p>
              <h3 className="text-xl font-bold text-ajo-ink mb-3">Secure Wallet</h3>
              <p className="text-ajo-inkSoft">
                Your funds are protected with bank-level security. Deposit, withdraw, and manage your money with confidence.
              </p>
            </div>

            {/* Service 5 */}
            <div className="rounded-card border border-ajo-line bg-white p-6 transition hover:shadow-lg">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-ajo-primarySoft">
                <Users className="h-6 w-6 text-ajo-primary" />
              </div>
              <p className="text-sm font-semibold text-ajo-primary mb-2">Management</p>
              <h3 className="text-xl font-bold text-ajo-ink mb-3">Group Management</h3>
              <p className="text-ajo-inkSoft">
                Admins can manage members, lock rotation order, track contributions, and monitor group activity in real-time.
              </p>
            </div>

            {/* Service 6 */}
            <div className="rounded-card border border-ajo-line bg-white p-6 transition hover:shadow-lg">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-ajo-primarySoft">
                <Smartphone className="h-6 w-6 text-ajo-primary" />
              </div>
              <p className="text-sm font-semibold text-ajo-primary mb-2">Mobile App</p>
              <h3 className="text-xl font-bold text-ajo-ink mb-3">Mobile Access</h3>
              <p className="text-ajo-inkSoft">
                Access your savings groups anytime, anywhere. Available on iOS and Android with real-time notifications.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="bg-ajo-surfaceSunken">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-28">
          <div className="text-center max-w-3xl mx-auto">
            <p className="eyebrow">How It Works</p>
            <h2 className="section-title mx-auto">
              Start saving in 4 simple steps
            </h2>
          </div>

          <div className="mt-12 grid gap-8 md:grid-cols-4">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-ajo-primary text-white">
                <span className="text-2xl font-bold">1</span>
              </div>
              <h3 className="text-lg font-bold text-ajo-ink mb-2">Download App</h3>
              <p className="text-sm text-ajo-inkSoft">Get the Ajo app from App Store or Google Play</p>
            </div>

            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-ajo-primary text-white">
                <span className="text-2xl font-bold">2</span>
              </div>
              <h3 className="text-lg font-bold text-ajo-ink mb-2">Create or Join</h3>
              <p className="text-sm text-ajo-inkSoft">Start a new group or join an existing one</p>
            </div>

            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-ajo-primary text-white">
                <span className="text-2xl font-bold">3</span>
              </div>
              <h3 className="text-lg font-bold text-ajo-ink mb-2">Contribute</h3>
              <p className="text-sm text-ajo-inkSoft">Make automated or manual contributions</p>
            </div>

            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-ajo-primary text-white">
                <span className="text-2xl font-bold">4</span>
              </div>
              <h3 className="text-lg font-bold text-ajo-ink mb-2">Get Payout</h3>
              <p className="text-sm text-ajo-inkSoft">Receive your turn payout when it's time</p>
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
              Built for trust and transparency.
            </h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-card border border-ajo-line bg-white p-6">
              <Shield className="h-6 w-6 text-ajo-primary mb-3" />
              <h3 className="text-lg font-bold text-ajo-ink mb-2">Secure & Reliable</h3>
              <p className="text-sm text-ajo-inkSoft">Bank-level encryption and secure payment processing</p>
            </div>

            <div className="rounded-card border border-ajo-line bg-white p-6">
              <Users className="h-6 w-6 text-ajo-primary mb-3" />
              <h3 className="text-lg font-bold text-ajo-ink mb-2">Community Driven</h3>
              <p className="text-sm text-ajo-inkSoft">Built on trust, designed for communities</p>
            </div>

            <div className="rounded-card border border-ajo-line bg-white p-6">
              <Zap className="h-6 w-6 text-ajo-primary mb-3" />
              <h3 className="text-lg font-bold text-ajo-ink mb-2">Fast & Efficient</h3>
              <p className="text-sm text-ajo-inkSoft">Quick setup, instant notifications, seamless experience</p>
            </div>

            <div className="rounded-card border border-ajo-line bg-white p-6">
              <Heart className="h-6 w-6 text-ajo-primary mb-3" />
              <h3 className="text-lg font-bold text-ajo-ink mb-2">Transparent</h3>
              <p className="text-sm text-ajo-inkSoft">Full visibility into contributions and payouts</p>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="bg-ajo-primary px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-28">
        <div className="mx-auto max-w-7xl">
          <div className="text-center mb-12">
            <p className="eyebrow text-ajo-accent">Testimonials</p>
            <h2 className="text-3xl md:text-4xl font-bold text-white">What our users say</h2>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            <div className="rounded-card bg-white p-6">
              <p className="text-ajo-ink mb-4">"Ajo has made saving so much easier. I've completed three cycles already and it's been a game-changer for my finances."</p>
              <strong className="text-ajo-ink">Sarah A.</strong>
              <p className="text-sm text-ajo-inkSoft">Small business owner</p>
            </div>

            <div className="rounded-card bg-white p-6">
              <p className="text-ajo-ink mb-4">"The automated contributions feature is brilliant. I don't have to think about it - my savings just grow automatically."</p>
              <strong className="text-ajo-ink">Michael O.</strong>
              <p className="text-sm text-ajo-inkSoft">Freelancer</p>
            </div>

            <div className="rounded-card bg-white p-6">
              <p className="text-ajo-ink mb-4">"Finally, a modern solution for traditional savings groups. The transparency and security gives me peace of mind."</p>
              <strong className="text-ajo-ink">Grace E.</strong>
              <p className="text-sm text-ajo-inkSoft">Healthcare worker</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section id="contact" className="bg-ajo-ink px-4 py-16 text-center text-white sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <p className="eyebrow text-ajo-accent">Ready to Start?</p>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mx-auto max-w-3xl">
            Join thousands already saving smarter with Ajo
          </h2>
          <div className="mx-auto mt-8 flex flex-wrap justify-center gap-4">
            <button className="btn-primary">
              <Download className="h-5 w-5" />
              Download App
            </button>
            <a href="mailto:support@ajo.app" className="btn-secondary">
              <Mail className="h-5 w-5" />
              Contact Us
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-ajo-surfaceSunken border-t border-ajo-line px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-ajo-primary">
                  <span className="text-xl font-bold text-white">A</span>
                </div>
                <span className="text-xl font-bold text-ajo-ink">Ajo</span>
              </div>
              <p className="text-sm text-ajo-inkSoft leading-relaxed">
                Digital savings and investment platform. Save together, thrive together.
              </p>
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold text-ajo-ink">Quick Links</h3>
              <nav className="flex flex-col space-y-2 text-sm">
                <a href="#about" className="text-ajo-inkSoft hover:text-ajo-ink transition">About</a>
                <a href="#services" className="text-ajo-inkSoft hover:text-ajo-ink transition">Services</a>
                <a href="#how-it-works" className="text-ajo-inkSoft hover:text-ajo-ink transition">How It Works</a>
                <a href="#why-us" className="text-ajo-inkSoft hover:text-ajo-ink transition">Why Us</a>
                <Link href="/privacy-policy" className="text-ajo-inkSoft hover:text-ajo-ink transition">Privacy Policy</Link>
                <Link href="/terms-and-conditions" className="text-ajo-inkSoft hover:text-ajo-ink transition">Terms & Conditions</Link>
              </nav>
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold text-ajo-ink">Services</h3>
              <nav className="flex flex-col space-y-2 text-sm">
                <a href="#services" className="text-ajo-inkSoft hover:text-ajo-ink transition">Create Groups</a>
                <a href="#services" className="text-ajo-inkSoft hover:text-ajo-ink transition">Join Groups</a>
                <a href="#services" className="text-ajo-inkSoft hover:text-ajo-ink transition">Automated Savings</a>
                <a href="#services" className="text-ajo-inkSoft hover:text-ajo-ink transition">Rotating Payouts</a>
              </nav>
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold text-ajo-ink">Get in Touch</h3>
              <div className="space-y-2 text-sm">
                <a href="mailto:support@ajo.app" className="flex items-center gap-2 text-ajo-inkSoft hover:text-ajo-ink transition">
                  <Mail className="h-4 w-4" />
                  support@ajo.app
                </a>
              </div>
            </div>
          </div>

          <div className="mt-8 border-t border-ajo-line pt-8 text-center text-sm text-ajo-inkSoft">
            <p>&copy; 2026 Ajo Digital Smart Environment. All rights reserved. <Link href="/privacy-policy" className="font-semibold hover:text-ajo-ink">Privacy Policy</Link> · <Link href="/terms-and-conditions" className="font-semibold hover:text-ajo-ink">Terms & Conditions</Link></p>
          </div>
        </div>
      </footer>
    </main>
  )
}