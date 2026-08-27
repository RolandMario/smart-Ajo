import { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Privacy Policy - Digital Smart Environment',
  description: 'Learn how Digital Smart Environment and the Ajo platform collect, use, and protect your personal information.',
}

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-ajo-canvas">
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="bg-white rounded-card border border-ajo-line p-8 md:p-12">
          <h1 className="text-3xl md:text-4xl font-bold text-ajo-ink mb-8">Privacy Policy</h1>
          
          <div className="prose prose-lg max-w-none">
            <div className="mb-8 pb-8 border-b border-ajo-line">
              <p className="text-sm text-ajo-inkSoft">
                <strong>Last Updated:</strong> July 2, 2026<br />
                <strong>Effective Date:</strong> July 2, 2026
              </p>
            </div>

            <div className="space-y-8 text-ajo-inkSoft">
              <section>
                <h2 className="text-2xl font-bold text-ajo-ink mb-4">1. Introduction</h2>
                <p className="mb-4">
                  Ajo ("we," "our," or "us") is a digital thrift-collection (esusu/ajo) platform that enables users to create or join savings groups, contribute in rotating cycles, and manage payments through our mobile application and web services. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our platform.
                </p>
                <p>
                  We are committed to protecting your privacy and ensuring the security of your personal information. This policy applies to all users of our services, including:
                </p>
                <ul className="list-disc pl-6 mt-2 space-y-1">
                  <li><strong>ajo-mobile</strong>: Our member-facing mobile application</li>
                  <li><strong>ajo-server</strong>: Our backend API services</li>
                  <li><strong>ajo-admin-web</strong>: Our internal platform administration console</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-ajo-ink mb-4">2. Information We Collect</h2>
                
                <h3 className="text-xl font-semibold text-ajo-ink mt-6 mb-3">2.1 Personal Information</h3>
                <p className="font-semibold text-ajo-ink mb-2">Account Information:</p>
                <ul className="list-disc pl-6 space-y-1 mb-4">
                  <li><strong>Phone Number</strong>: Your primary identifier (required, stored in E.164 format)</li>
                  <li><strong>Email Address</strong>: Optional, used for account recovery and notifications</li>
                  <li><strong>Full Name</strong>: Optional, used for personalization</li>
                  <li><strong>Password</strong>: Only for platform administrators (hashed, never stored in plaintext)</li>
                </ul>

                <p className="font-semibold text-ajo-ink mb-2">Authentication Data:</p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>One-Time Passwords (OTPs): Generated for login verification, hashed and auto-expired</li>
                  <li>JWT Tokens: Session tokens with minimal payload (user ID, role, phone, email)</li>
                  <li>Device Tokens: Firebase Cloud Messaging (FCM) tokens for push notifications</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-ajo-ink mb-4">3. How We Use Your Information</h2>
                <p className="mb-4">We use your information to provide and improve our services:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li><strong>Authentication & Account Management:</strong> Verify your identity, create and manage your account, maintain secure sessions</li>
                  <li><strong>Payment Processing:</strong> Process wallet funding, automate contributions, initiate payouts</li>
                  <li><strong>Group Management:</strong> Create and administer savings groups, send invitations, track contributions</li>
                  <li><strong>Notifications:</strong> Send push notifications, SMS alerts, and in-app notifications</li>
                  <li><strong>Security:</strong> Authenticate requests, detect unauthorized access, prevent fraud</li>
                  <li><strong>Service Improvement:</strong> Debug issues, analyze usage patterns, test new features</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-ajo-ink mb-4">4. Third-Party Services</h2>
                <p className="mb-4">We use trusted third-party services to operate our platform:</p>
                
                <div className="bg-ajo-surface-sunken p-6 rounded-card mb-4">
                  <h3 className="font-semibold text-ajo-ink mb-2">Payment Processing (Paystack)</h3>
                  <p className="text-sm">We use Paystack for payment processing. Paystack collects payment card details and processes transactions. Their privacy policy governs their data collection.</p>
                </div>

                <div className="bg-ajo-surface-sunken p-6 rounded-card mb-4">
                  <h3 className="font-semibold text-ajo-ink mb-2">SMS Services (Termii)</h3>
                  <p className="text-sm">We use Termii for SMS delivery of OTPs and notifications. Termii sends SMS messages to your phone number.</p>
                </div>

                <div className="bg-ajo-surface-sunken p-6 rounded-card">
                  <h3 className="font-semibold text-ajo-ink mb-2">Push Notifications (Firebase Cloud Messaging)</h3>
                  <p className="text-sm">We use Firebase Cloud Messaging for push notifications. FCM delivers notifications to your device.</p>
                </div>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-ajo-ink mb-4">5. Data Storage and Security</h2>
                <p className="mb-4">We implement industry-standard security measures to protect your data:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li><strong>Encryption:</strong> All API communications use HTTPS/TLS, JWT tokens are signed and verified</li>
                  <li><strong>Access Controls:</strong> Role-based access, group-level permissions, JWT re-verification on every request</li>
                  <li><strong>Data Storage:</strong> MongoDB with Mongoose schemas, OTP codes hashed with bcrypt and TTL indexes</li>
                  <li><strong>Token Storage:</strong> Mobile app uses secure storage, admin web uses httpOnly cookies</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-ajo-ink mb-4">6. Your Rights and Choices</h2>
                <ul className="list-disc pl-6 space-y-2">
                  <li><strong>Access and Update:</strong> View and update your profile information via the app</li>
                  <li><strong>Account Deletion:</strong> Contact us to request account deletion within 30 days</li>
                  <li><strong>Notification Preferences:</strong> Manage push notification permissions in device settings</li>
                  <li><strong>Data Portability:</strong> Request a copy of your personal data in JSON format</li>
                  <li><strong>Opt-Out:</strong> Opt out of non-essential notifications or request data deletion</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-ajo-ink mb-4">7. Data Retention</h2>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Account data retained for the duration of your account activity</li>
                  <li>Financial transaction records retained for 7 years (legal requirement)</li>
                  <li>Notification history retained for 90 days</li>
                  <li>OTP records auto-deleted after 15 minutes</li>
                  <li>Personal data deleted within 30 days of account deletion request</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-ajo-ink mb-4">8. Contact Information</h2>
                <p className="mb-4">For privacy-related inquiries, requests, or complaints:</p>
                <div className="bg-ajo-surface-sunken p-6 rounded-card">
                  <p className="font-semibold text-ajo-ink">Data Protection Officer</p>
                  <p>Ajo Platform</p>
                  <p>Email: <a href="mailto:roland.ayuk@digitalsmartenvironment.com" className="text-ajo-primary hover:underline">hello@digitalsmartenvironment.com</a></p>
                  
                  <p className="mt-2">No 1 Oguntolo street, Ijaiye, Lagos, Nigeria</p>
                  <p className="text-sm mt-2">We aim to respond to all privacy requests within 30 days.</p>
                </div>
              </section>
            </div>

            <div className="mt-12 pt-8 border-t border-ajo-line">
              <Link href="/" className="btn-primary inline-flex">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back to Home
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}