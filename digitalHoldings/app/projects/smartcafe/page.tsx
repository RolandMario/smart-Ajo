import { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
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
              {/* App store download badges */}
              <div className="mt-8 flex flex-wrap gap-4">
                <a
                  href="https://play.google.com/store/apps/details?id=com.smartcafe.mobile"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Get the SmartCafe app on Google Play"
                  className="inline-flex items-center gap-3 rounded-xl bg-ajo-ink px-4 py-2.5 text-white transition hover:-translate-y-0.5 hover:shadow-lg"
                >
                  <svg viewBox="0 0 24 24" className="h-6 w-6 shrink-0 fill-current" aria-hidden="true">
                    <path d="M22.018 13.298l-3.919 2.218-3.515-3.493 3.543-3.521 3.891 2.202a1.49 1.49 0 0 1 0 2.594zM1.337.924a1.486 1.486 0 0 0-.112.568v21.017c0 .217.045.419.124.6l11.155-11.087L1.337.924zm12.207 10.065l3.258-3.238L3.45.195a1.466 1.466 0 0 0-.946-.179l11.04 10.973zm0 2.067l-11 10.933c.298.036.612-.016.906-.183l13.324-7.54-3.23-3.21z" />
                  </svg>
                  <span className="flex flex-col leading-none">
                    <span className="text-[10px] font-medium uppercase tracking-wide text-white/70">Get it on</span>
                    <span className="mt-1 text-base font-bold">Google Play</span>
                  </span>
                </a>
                <a
                  href="https://apps.apple.com/ng/app/smartkafe/id6809169227"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Download the SmartCafe app on the App Store"
                  className="inline-flex items-center gap-3 rounded-xl bg-ajo-ink px-4 py-2.5 text-white transition hover:-translate-y-0.5 hover:shadow-lg"
                >
                  <svg viewBox="0 0 24 24" className="h-6 w-6 shrink-0 fill-current" aria-hidden="true">
                    <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
                  </svg>
                  <span className="flex flex-col leading-none">
                    <span className="text-[10px] font-medium uppercase tracking-wide text-white/70">Download on the</span>
                    <span className="mt-1 text-base font-bold">App Store</span>
                  </span>
                </a>
              </div>
              <div className="mt-4 flex flex-wrap gap-4">
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
              <div className="rounded-card p-4 shadow-soft">
                <div className="flex min-h-[460px] w-full items-center justify-center rounded-card">
                  <div className="relative h-[400px] w-[170px] -rotate-[40deg]">
                    {/* side buttons */}
                    <div className="absolute -left-[3px] top-24 h-8 w-[3px] rounded-l-md bg-ajo-ink/70" />
                    <div className="absolute -left-[3px] top-36 h-12 w-[3px] rounded-l-md bg-ajo-ink/70" />
                    <div className="absolute -right-[3px] top-28 h-16 w-[3px] rounded-r-md bg-ajo-ink/70" />
                    {/* bezel */}
                    <div className="relative h-full w-full rounded-[2.2rem] bg-ajo-ink p-[6px] shadow-2xl">
                      {/* screen */}
                      <div className="relative h-full w-full overflow-hidden rounded-[1.7rem] bg-ajo-surfaceSunken">
                        <Image
                          src="/images/Smartcafe.png"
                          alt="SmartCafe mobile app home screen"
                          fill
                          priority
                          sizes="170px"
                          className="object-cover"
                        />
                        {/* notch */}
                        <div className="absolute left-1/2 top-2 z-10 h-4 w-20 -translate-x-1/2 rounded-full bg-ajo-ink" />
                      </div>
                    </div>
                  </div>
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