import { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Users, Zap, CheckCircle, Shield, Smartphone, Globe, Layers } from 'lucide-react'
import NavBar from '../../components/navBar'

export const metadata: Metadata = {
  title: 'Ajo - A Digital Smart Environment Project',
  description:
    'Ajo is a modern digital savings platform built by Digital Smart Environment. Create or join savings groups, automate contributions, and receive rotating payouts.',
}

export default function AjoProjectPage() {
  return (
    <main className="min-h-screen bg-ajo-canvas">
      <NavBar />

      {/* Hero */}
      <section className="bg-white">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <p className="eyebrow">Digital Smart Environment · Flagship Project</p>
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div>
              <h1 className="text-4xl md:text-5xl font-bold text-ajo-ink leading-tight">
                Ajo — Save Together, Thrive Together.
              </h1>
              <p className="mt-6 text-lg text-ajo-inkSoft leading-relaxed">
                Ajo brings the traditional savings group experience into the modern era. Built by Digital Smart
                Environment, it lets people create or join savings groups, automate contributions, and receive
                rotating payouts — all from their phone.
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <a href="/contact" className="btn-primary">
                  Work With Us
                  <ArrowRight className="h-5 w-5" />
                </a>
                <Link href="/" className="btn-outline">
                  Back to Home
                </Link>
              </div>
            </div>

            <div className="relative flex justify-center">
              <div className="rounded-card bg-ajo-primary p-4 shadow-soft">
                <div className="flex h-[340px] w-full items-center justify-center rounded-card bg-ajo-surfaceSunken">
                  <Smartphone className="h-32 w-32 text-ajo-primary" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      {/* Features */}
      <section className="bg-ajo-canvas">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <p className="eyebrow">What Ajo Does</p>
            <h2 className="section-title">Digital savings groups, simplified.</h2>
            <p className="mt-4 section-copy">
              Ajo is one of the projects executed by Digital Smart Environment, showcasing our end-to-end ability to
              design, develop, and deliver a full digital product — from backend services to a member-facing mobile
              app and an admin console.
            </p>
          </div>

          <div className="mt-12 grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-card border border-ajo-line bg-white p-6">
              <Users className="h-6 w-6 text-ajo-primary mb-3" />
              <h3 className="text-lg font-bold text-ajo-ink mb-2">Create or Join Groups</h3>
              <p className="text-sm text-ajo-inkSoft">Start savings groups with custom amounts, frequency, and limits.</p>
            </div>
            <div className="rounded-card border border-ajo-line bg-white p-6">
              <Zap className="h-6 w-6 text-ajo-primary mb-3" />
              <h3 className="text-lg font-bold text-ajo-ink mb-2">Automated Contributions</h3>
              <p className="text-sm text-ajo-inkSoft">Auto-debit wallets so members never miss a payment.</p>
            </div>
            <div className="rounded-card border border-ajo-line bg-white p-6">
              <CheckCircle className="h-6 w-6 text-ajo-primary mb-3" />
              <h3 className="text-lg font-bold text-ajo-ink mb-2">Rotating Payouts</h3>
              <p className="text-sm text-ajo-inkSoft">Fair, transparent, automated rotation ensures everyone benefits.</p>
            </div>
            <div className="rounded-card border border-ajo-line bg-white p-6">
              <Shield className="h-6 w-6 text-ajo-primary mb-3" />
              <h3 className="text-lg font-bold text-ajo-ink mb-2">Secure Wallet</h3>
              <p className="text-sm text-ajo-inkSoft">Bank-level security protecting deposits and management.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Delivered surface */}
      <section className="bg-white">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <p className="eyebrow">The Build</p>
            <h2 className="section-title">A complete, production-ready product.</h2>
          </div>
          <div className="mt-12 grid gap-8 lg:grid-cols-3">
            <div className="rounded-card border border-ajo-line bg-white p-6">
              <Smartphone className="h-6 w-6 text-ajo-primary mb-3" />
              <h3 className="text-lg font-bold text-ajo-ink mb-2">Member Mobile App</h3>
              <p className="text-sm text-ajo-inkSoft">The member-facing app for joining groups, contributing, and managing savings on the go.</p>
            </div>
            <div className="rounded-card border border-ajo-line bg-white p-6">
              <Globe className="h-6 w-6 text-ajo-primary mb-3" />
              <h3 className="text-lg font-bold text-ajo-ink mb-2">Backend Services</h3>
              <p className="text-sm text-ajo-inkSoft">Secure APIs powering groups, cycles, contributions, payouts, and wallets.</p>
            </div>
            <div className="rounded-card border border-ajo-line bg-white p-6">
              <Layers className="h-6 w-6 text-ajo-primary mb-3" />
              <h3 className="text-lg font-bold text-ajo-ink mb-2">Admin Console</h3>
              <p className="text-sm text-ajo-inkSoft">An internal console for platform administration and operations.</p>
            </div>
          </div>

          <div className="mt-12 rounded-card bg-ajo-primary p-8 text-white sm:p-12">
            <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
              <div>
                <h3 className="text-2xl font-bold mb-2">Want a product built like Ajo?</h3>
                <p className="text-white/90">
                  Digital Smart Environment can design, develop, and deliver your next digital solution end-to-end.
                </p>
              </div>
              <a href="/contact" className="inline-flex shrink-0 items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-ajo-primary transition hover:-translate-y-0.5 hover:shadow-lg">
                Start a Project
                <ArrowRight className="h-5 w-5" />
              </a>
            </div>
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
                  <span className="text-xl font-bold text-white">D</span>
                </div>
                <span className="text-xl font-bold text-ajo-ink">Digital Smart<br />Environment</span>
              </div>
              <p className="text-sm text-ajo-inkSoft leading-relaxed">
                A forward-thinking technology company delivering innovative digital solutions. Ajo is one of our flagship projects.
              </p>
            </div>
            <div className="space-y-4">
              <h3 className="font-semibold text-ajo-ink">Quick Links</h3>
              <nav className="flex flex-col space-y-2 text-sm">
                <Link href="/" className="text-ajo-inkSoft hover:text-ajo-ink transition">Home</Link>
                <Link href="/#services" className="text-ajo-inkSoft hover:text-ajo-ink transition">Services</Link>
                <Link href="/#projects" className="text-ajo-inkSoft hover:text-ajo-ink transition">Projects</Link>
                <Link href="/contact" className="text-ajo-inkSoft hover:text-ajo-ink transition">Contact</Link>
              </nav>
            </div>
            <div className="space-y-4">
              <h3 className="font-semibold text-ajo-ink">Services</h3>
              <nav className="flex flex-col space-y-2 text-sm">
                <Link href="/#services" className="text-ajo-inkSoft hover:text-ajo-ink transition">Custom Software Development</Link>
                <Link href="/#services" className="text-ajo-inkSoft hover:text-ajo-ink transition">Mobile & Web Apps</Link>
                <Link href="/#services" className="text-ajo-inkSoft hover:text-ajo-ink transition">Responsive Website Design</Link>
                <Link href="/#services" className="text-ajo-inkSoft hover:text-ajo-ink transition">Digital Transformation</Link>
              </nav>
            </div>
            <div className="space-y-4">
              <h3 className="font-semibold text-ajo-ink">Get in Touch</h3>
              <Link href="mailto:hello@digitalsmartenvironment.com" className="text-sm text-ajo-inkSoft hover:text-ajo-ink transition">
                hello@digitalsmartenvironment.com
              </Link>
            </div>
          </div>
          <div className="mt-8 border-t border-ajo-line pt-8 text-center text-sm text-ajo-inkSoft">
            <p>&copy; 2026 Digital Smart Environment. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </main>
  )
}

