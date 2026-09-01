import { Metadata } from 'next'
import Link from 'next/link'
import {
  ArrowRight,
  Globe,
  GraduationCap,
  Layers,
  MessagesSquare,
  MonitorPlay,
  Phone,
  Smartphone,
  Wifi,
  Zap,
} from 'lucide-react'
import NavBar from '../../components/navBar'
import Footer from '@/app/components/footer'

export const metadata: Metadata = {
  title: 'SmartCafe - A Digital Smart Environment Project',
  description:
    'SmartCafe is a full-stack Nigerian VTU (Virtual Top-Up) platform built by Digital Smart Environment. Buy airtime, data, cable TV, electricity, WAEC, and bulk SMS — all from one secure, wallet-first app.',
}

export default function SmartCafeProjectPage() {
  return (
    <main className="min-h-screen bg-ajo-canvas">
      <NavBar />

      {/* Hero */}
      <section className="bg-white">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <p className="eyebrow">Digital Smart Environment · VTU Platform</p>
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div>
              <h1 className="text-4xl md:text-5xl font-bold text-ajo-ink leading-tight">
                SmartCafe — Virtual Top-Up & Bills Payment Platform.
              </h1>
              <p className="mt-6 text-lg text-ajo-inkSoft leading-relaxed">
                SmartCafe brings VTU (Virtual Top-Up) services into one seamless app. Built by Digital Smart
                Environment, it lets users buy airtime, data bundles, cable TV subscriptions, electricity tokens,
                WAEC pins, and bulk SMS campaigns — all from their phone.
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

      {/* Services */}
      <section className="bg-ajo-canvas">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <p className="eyebrow">What SmartCafe Does</p>
            <h2 className="section-title">Every VTU service, in one place.</h2>
            <p className="mt-4 section-copy">
              SmartCafe is one of the projects executed by Digital Smart Environment, showcasing our end-to-end ability to
              design, develop, and deliver a full digital product — from a vendor-integrated backend to a
              customer-facing mobile app and an admin console.
            </p>
          </div>
          <div className="mt-12 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-card border border-ajo-line bg-white p-6">
              <Phone className="h-6 w-6 text-ajo-primary mb-3" />
              <h3 className="text-lg font-bold text-ajo-ink mb-2">Airtime</h3>
              <p className="text-sm text-ajo-inkSoft">MTN, Airtel, GLO, and 9mobile top-up with custom amounts.</p>
            </div>
            <div className="rounded-card border border-ajo-line bg-white p-6">
              <Wifi className="h-6 w-6 text-ajo-primary mb-3" />
              <h3 className="text-lg font-bold text-ajo-ink mb-2">Data Bundles</h3>
              <p className="text-sm text-ajo-inkSoft">All major networks, multiple bundle sizes, catalog-driven and quick to buy.</p>
            </div>
            <div className="rounded-card border border-ajo-line bg-white p-6">
              <MonitorPlay className="h-6 w-6 text-ajo-primary mb-3" />
              <h3 className="text-lg font-bold text-ajo-ink mb-2">Cable TV</h3>
              <p className="text-sm text-ajo-inkSoft">DStv, GOtv, and StarTimes subscriptions with smart-card customer verification.</p>
            </div>
            <div className="rounded-card border border-ajo-line bg-white p-6">
              <Zap className="h-6 w-6 text-ajo-primary mb-3" />
              <h3 className="text-lg font-bold text-ajo-ink mb-2">Electricity</h3>
              <p className="text-sm text-ajo-inkSoft">12 Nigerian Discos with meter verification and instant token delivery.</p>
            </div>
            <div className="rounded-card border border-ajo-line bg-white p-6">
              <GraduationCap className="h-6 w-6 text-ajo-primary mb-3" />
              <h3 className="text-lg font-bold text-ajo-ink mb-2">WAEC</h3>
              <p className="text-sm text-ajo-inkSoft">Result checker PINs instantly and candidate registration, PINs/serials.</p>
            </div>
            <div className="rounded-card border border-ajo-line bg-white p-6">
              <MessagesSquare className="h-6 w-6 text-ajo-primary mb-3" />
              <h3 className="text-lg font-bold text-ajo-ink mb-2">Bulk SMS</h3>
              <p className="text-sm text-ajo-inkSoft">Sender-ID campaigns with live unit-cost quoting for your business.</p>
            </div>
          </div>
        </div>
      </section>

      {/* The Build */}
      <section className="bg-white">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <p className="eyebrow">The Build</p>
            <h2 className="section-title">A complete, production-ready VTU platform.</h2>
          </div>
          <div className="mt-12 grid gap-8 lg:grid-cols-3">
            <div className="rounded-card border border-ajo-line bg-white p-6">
              <Smartphone className="h-6 w-6 text-ajo-primary mb-3" />
              <h3 className="text-lg font-bold text-ajo-ink mb-2">Customer Mobile App</h3>
              <p className="text-sm text-ajo-inkSoft">The React Native app for buying airtime, data, cable TV, electricity, WAEC, and bulk SMS on the go.</p>
            </div>
            <div className="rounded-card border border-ajo-line bg-white p-6">
              <Globe className="h-6 w-6 text-ajo-primary mb-3" />
              <h3 className="text-lg font-bold text-ajo-ink mb-2">Backend Services</h3>
              <p className="text-sm text-ajo-inkSoft">A NestJS + MongoDB API with wallets, atomic transactions, vendor integrations, and  wallet funding.</p>
            </div>
            <div className="rounded-card border border-ajo-line bg-white p-6">
              <Layers className="h-6 w-6 text-ajo-primary mb-3" />
              <h3 className="text-lg font-bold text-ajo-ink mb-2">Admin Console</h3>
              <p className="text-sm text-ajo-inkSoft">A Next.js dashboard for catalog, users, transactions, funding, and per-service vendor routing.</p>
            </div>
          </div>
          <div className="mt-12 rounded-card bg-ajo-primary p-8 text-white sm:p-12">
            <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
              <div>
                <h3 className="text-2xl font-bold mb-2">Want a product built like SmartCafe?</h3>
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
  

      <Footer/>
    </main>
  )
}