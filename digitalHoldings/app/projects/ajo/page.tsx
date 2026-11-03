import { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import {
  ArrowRight,
  CheckCircle,
  Globe,
  HandCoins,
  Landmark,
  Layers,
  PiggyBank,
  Shield,
  Smartphone,
  Users,
  Wallet,
} from 'lucide-react'
import NavBar from '../../components/navBar'
import Footer from '@/app/components/footer'

export const metadata: Metadata = {
  title: 'SmartThrift - A Digital Smart Environment Project',
  description:
    'SmartThrift is a modern digital savings platform built by Digital Smart Environment. Run rotating contribution groups, save towards personal goals, and pool funds for shared purposes — all from one secure app.',
}

export default function SmartThriftProjectPage() {
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
                SmartThrift — Save Together, Thrive Together.
              </h1>
              <p className="mt-6 text-lg text-ajo-ink-soft leading-relaxed">
                SmartThrift (formerly Ajo) brings the traditional savings group experience into the modern era. Built
                by Digital Smart Environment, it lets people run rotating contribution groups, save towards personal
                goals, and pool funds for shared purposes — all from their phone.
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
                <div className="flex h-[340px] w-full flex-col items-center justify-center gap-6 rounded-card bg-ajo-surface-sunken px-10">
                  <Image
                    src="/images/SmartThrift.png"
                    alt="SmartThrift app logo"
                    width={442}
                    height={286}
                    priority
                    className="h-auto w-48 sm:w-56"
                  />
                  <span className="text-sm font-semibold uppercase tracking-wide text-ajo-primary">SmartThrift</span>
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
            <p className="eyebrow">What SmartThrift Does</p>
            <h2 className="section-title">Three ways to save, one simple app.</h2>
            <p className="mt-4 section-copy">
              SmartThrift is one of the projects executed by Digital Smart Environment, showcasing our end-to-end
              ability to design, develop, and deliver a full digital product — from backend services to a
              member-facing mobile app and an admin console.
            </p>
          </div>

          <div className="mt-12 grid gap-8 lg:grid-cols-3">
            <div className="rounded-card border border-ajo-line bg-white p-6">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-ajo-primary-soft">
                <Users className="h-6 w-6 text-ajo-primary" />
              </div>
              <p className="text-sm font-semibold text-ajo-primary mb-2">01 · Rotating Savings</p>
              <h3 className="text-xl font-bold text-ajo-ink mb-3">Group Contributions</h3>
              <p className="text-sm text-ajo-ink-soft leading-relaxed">
                Members form contribution groups, each contributing an agreed amount on a regular basis. The pooled
                funds are then disbursed to one member per cycle until every member has received their turn.
              </p>
              <ul className="mt-4 space-y-2 text-sm text-ajo-ink-soft">
                <li className="flex items-start gap-2">
                  <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-ajo-success" />
                  Custom contribution amount and cycle schedule
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-ajo-success" />
                  Daily, weekly, or monthly contributions
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-ajo-success" />
                  Rotation order set by the group admin
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-ajo-success" />
                  One member collects the pooled payout each cycle
                </li>
              </ul>
            </div>
            <div className="rounded-card border border-ajo-line bg-white p-6">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-ajo-primary-soft">
                <PiggyBank className="h-6 w-6 text-ajo-primary" />
              </div>
              <p className="text-sm font-semibold text-ajo-primary mb-2">02 · Goal-Based Budgeting</p>
              <h3 className="text-xl font-bold text-ajo-ink mb-3">Individual Savings</h3>
              <p className="text-sm text-ajo-ink-soft leading-relaxed">
                Users can set aside a fixed amount of money for a defined period and initiate a payout once their
                savings goal is reached.
              </p>
              <ul className="mt-4 space-y-2 text-sm text-ajo-ink-soft">
                <li className="flex items-start gap-2">
                  <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-ajo-success" />
                  Name a plan after its purpose — rent, school fees, a project
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-ajo-success" />
                  Set the amount, frequency, and duration that suit the goal
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-ajo-success" />
                  Pay into the plan from your wallet at each interval
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-ajo-success" />
                  Request a payout as soon as the goal is reached
                </li>
              </ul>
            </div>
            <div className="rounded-card border border-ajo-line bg-white p-6">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-ajo-primary-soft">
                <HandCoins className="h-6 w-6 text-ajo-primary" />
              </div>
              <p className="text-sm font-semibold text-ajo-primary mb-2">03 · Shared Goals</p>
              <h3 className="text-xl font-bold text-ajo-ink mb-3">Pool Collection</h3>
              <p className="text-sm text-ajo-ink-soft leading-relaxed">
                A group can be formed to collect funds that will be used for a specific purpose agreed upon by the
                members — a project, an event, or a shared goal. The collected funds are held and later disbursed
                according to the group's decision.
              </p>
              <ul className="mt-4 space-y-2 text-sm text-ajo-ink-soft">
                <li className="flex items-start gap-2">
                  <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-ajo-success" />
                  Create a group around a shared purpose
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-ajo-success" />
                  Members contribute towards the agreed target
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-ajo-success" />
                  Every contribution is tracked per member
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-ajo-success" />
                  Funds are held, then disbursed by the group's decision
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-10 grid gap-6 rounded-card border border-ajo-line bg-white p-6 sm:p-8 md:grid-cols-2 lg:grid-cols-4">
            <div className="flex items-start gap-3">
              <Wallet className="mt-0.5 h-5 w-5 shrink-0 text-ajo-primary" />
              <div>
                <h3 className="text-sm font-bold text-ajo-ink">Wallet-first payments</h3>
                <p className="mt-1 text-sm text-ajo-ink-soft">
                  Fund every group, plan, or pool straight from your in-app wallet.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Shield className="mt-0.5 h-5 w-5 shrink-0 text-ajo-primary" />
              <div>
                <h3 className="text-sm font-bold text-ajo-ink">Funds held securely</h3>
                <p className="mt-1 text-sm text-ajo-ink-soft">
                  Contributions are held safely until it is time to disburse them.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-ajo-primary" />
              <div>
                <h3 className="text-sm font-bold text-ajo-ink">Transparent cycles</h3>
                <p className="mt-1 text-sm text-ajo-ink-soft">
                  Every contribution, cycle, and payout is tracked per member.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Landmark className="mt-0.5 h-5 w-5 shrink-0 text-ajo-primary" />
              <div>
                <h3 className="text-sm font-bold text-ajo-ink">Payouts to your bank</h3>
                <p className="mt-1 text-sm text-ajo-ink-soft">
                  Withdraw your savings straight to your saved bank account.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* The Build */}
      <section className="bg-white">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <p className="eyebrow">The Build</p>
            <h2 className="section-title">A complete, production-ready product.</h2>
            <p className="mt-4 section-copy">
              SmartThrift ships as one platform: a member mobile app, the backend services that move the money, and an
              admin console for operations.
            </p>
          </div>
          <div className="mt-12 grid gap-8 lg:grid-cols-3">
            <div className="rounded-card border border-ajo-line bg-white p-6">
              <Smartphone className="h-6 w-6 text-ajo-primary mb-3" />
              <h3 className="text-lg font-bold text-ajo-ink mb-2">Member Mobile App</h3>
              <p className="text-sm text-ajo-ink-soft leading-relaxed">
                The member-facing app for contribution groups, personal savings plans, pool collections, and wallet
                management on the go.
              </p>
            </div>
            <div className="rounded-card border border-ajo-line bg-white p-6">
              <Globe className="h-6 w-6 text-ajo-primary mb-3" />
              <h3 className="text-lg font-bold text-ajo-ink mb-2">Backend Services</h3>
              <p className="text-sm text-ajo-ink-soft leading-relaxed">
                Secure APIs powering groups, contribution cycles, savings plans, pools, payouts, and wallets.
              </p>
            </div>
            <div className="rounded-card border border-ajo-line bg-white p-6">
              <Layers className="h-6 w-6 text-ajo-primary mb-3" />
              <h3 className="text-lg font-bold text-ajo-ink mb-2">Admin Console</h3>
              <p className="text-sm text-ajo-ink-soft leading-relaxed">
                An internal console for platform administration, user management, and operational oversight.
              </p>
            </div>
          </div>

          <div className="mt-12 rounded-card bg-ajo-primary p-8 text-white sm:p-12">
            <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
              <div>
                <h3 className="text-2xl font-bold mb-2">Want a product built like SmartThrift?</h3>
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

      <Footer />
    </main>
  )
}

