import { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Terms and Conditions - Digital Smart Environment',
  description: 'Read the terms and conditions for using the Digital Smart Environment website and the Ajo platform.',
}

export default function TermsAndConditionsPage() {
  return (
    <main className="min-h-screen bg-ajo-canvas">
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="bg-white rounded-card border border-ajo-line p-8 md:p-12">
          <h1 className="text-3xl md:text-4xl font-bold text-ajo-ink mb-8">Terms and Conditions</h1>
          
          <div className="prose prose-lg max-w-none">
            <div className="mb-8 pb-8 border-b border-ajo-line">
              <p className="text-sm text-ajo-inkSoft">
                <strong>Last Updated:</strong> July 2, 2026<br />
                <strong>Effective Date:</strong> July 2, 2026
              </p>
            </div>

            <div className="space-y-8 text-ajo-inkSoft">
              <section>
                <h2 className="text-2xl font-bold text-ajo-ink mb-4">1. Acceptance of Terms</h2>
                <p>
                  By accessing or using the Ajo platform ("Platform"), including the ajo-mobile mobile application, ajo-server backend services, and ajo-admin-web administration console, you ("User," "you," or "your") agree to be bound by these Terms and Conditions ("Terms"). If you do not agree to these Terms, please do not use our services.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-ajo-ink mb-4">2. Description of Services</h2>
                <p className="mb-4">Ajo is a digital thrift-collection (esusu/ajo) platform that enables users to:</p>
                <ul className="list-disc pl-6 space-y-1 mb-4">
                  <li>Create or join savings groups</li>
                  <li>Contribute money on a rotating basis</li>
                  <li>Receive payouts according to a predetermined rotation order</li>
                  <li>Manage payments through integrated wallet services</li>
                  <li>Track contributions and group activity</li>
                  <li>Receive notifications about group activities</li>
                </ul>
                <p className="mb-2">Our services include:</p>
                <ul className="list-disc pl-6 space-y-1">
                  <li><strong>ajo-mobile</strong>: Member-facing mobile application for iOS and Android</li>
                  <li><strong>ajo-server</strong>: Backend API services for authentication, group management, and payment processing</li>
                  <li><strong>ajo-admin-web</strong>: Internal platform administration console for platform staff</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-ajo-ink mb-4">3. Eligibility</h2>
                <h3 className="text-xl font-semibold text-ajo-ink mt-6 mb-3">3.1 Age Requirement</h3>
                <p className="mb-4">You must be at least 18 years old to use our services. By using Ajo, you represent and warrant that you are 18 years of age or older.</p>
                
                <h3 className="text-xl font-semibold text-ajo-ink mt-6 mb-3">3.2 Legal Capacity</h3>
                <p className="mb-4">You must have the legal capacity to enter into a binding agreement. If you are using our services on behalf of a legal entity, you represent that you have the authority to bind that entity to these Terms.</p>
                
                <h3 className="text-xl font-semibold text-ajo-ink mt-6 mb-3">3.3 Account Registration</h3>
                <ul className="list-disc pl-6 space-y-1">
                  <li>You must provide a valid phone number for authentication</li>
                  <li>You must verify your identity via One-Time Password (OTP)</li>
                  <li>You must provide accurate and complete information during registration</li>
                  <li>You are responsible for maintaining the confidentiality of your account credentials</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-ajo-ink mb-4">4. Account Responsibilities</h2>
                <h3 className="text-xl font-semibold text-ajo-ink mt-6 mb-3">4.1 Account Security</h3>
                <ul className="list-disc pl-6 space-y-2">
                  <li>You are responsible for all activities that occur under your account</li>
                  <li>You must use strong passwords for platform administrator accounts</li>
                  <li>You must not share your authentication credentials with any third party</li>
                  <li>You must immediately notify us of any security breach or unauthorized use of your account</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-ajo-ink mb-4">5. Group Participation</h2>
                <h3 className="text-xl font-semibold text-ajo-ink mt-6 mb-3">5.1 Contribution Obligations</h3>
                <p className="mb-4">When you join a group, you commit to making all required contributions according to the group's schedule. Contributions are automatically debited from your wallet when collection is initiated.</p>
                
                <h3 className="text-xl font-semibold text-ajo-ink mt-6 mb-3">5.2 Rotation and Payouts</h3>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Rotation order is determined at group creation (manual or random) and cannot be changed once locked</li>
                  <li>Each member receives a payout according to their position in the rotation</li>
                  <li>Payouts are processed via bank transfer using Paystack (typically 1-2 business days)</li>
                  <li>You must have a verified bank account on file to receive payouts</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-ajo-ink mb-4">6. Wallet and Payments</h2>
                <ul className="list-disc pl-6 space-y-2">
                  <li><strong>Wallet Funding:</strong> Fund your wallet using Paystack payment links. Wallet funding is non-refundable except as required by law.</li>
                  <li><strong>Wallet Balances:</strong> Your wallet balance represents funds available for contributions and does not accrue interest.</li>
                  <li><strong>Contribution Debits:</strong> Contributions are automatically debited from your wallet and are non-reversible once confirmed.</li>
                  <li><strong>Refunds:</strong> Contribution refunds may be issued in cases of group cancellation or technical errors. Refund requests must be submitted within 30 days.</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-ajo-ink mb-4">7. Prohibited Activities</h2>
                <p className="mb-4">You agree not to:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Use our services for any illegal purpose or in violation of any laws</li>
                  <li>Create groups for pyramid schemes, Ponzi schemes, or other fraudulent activities</li>
                  <li>Create multiple accounts to circumvent restrictions</li>
                  <li>Use automated scripts or bots to access our services</li>
                  <li>Provide false or misleading information during registration</li>
                  <li>Harass, threaten, or intimidate other users</li>
                  <li>Attempt to gain unauthorized access to our systems</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-ajo-ink mb-4">8. Limitation of Liability</h2>
                <p className="mb-4">Our services are provided "as is" and "as available" without warranties of any kind. To the maximum extent permitted by law, Ajo Platform shall not be liable for indirect, incidental, special, consequential, or punitive damages.</p>
                <p>Our total liability to you for any claims shall not exceed the amount you paid us in the 12 months preceding the claim, or NGN 10,000 (Ten Thousand Naira), whichever is greater.</p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-ajo-ink mb-4">9. Termination</h2>
                <p className="mb-4">You may stop using our services at any time. We may suspend or terminate your access to our services for violation of these Terms, fraudulent or illegal activity, or extended period of inactivity.</p>
                <p>Upon termination, your right to access and use our services ceases immediately. Financial obligations incurred prior to termination remain your responsibility.</p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-ajo-ink mb-4">10. Dispute Resolution</h2>
                <p className="mb-4">We encourage you to contact us first to resolve any disputes informally at support@ajo.app. If informal resolution fails, disputes shall be resolved through binding arbitration administered by the Lagos Court of Arbitration.</p>
                <p>Arbitration shall be conducted in English, with the seat of arbitration in Lagos, Nigeria, governed by the laws of the Federal Republic of Nigeria.</p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-ajo-ink mb-4">11. Governing Law</h2>
                <p>These Terms shall be governed by and construed in accordance with the laws of the Federal Republic of Nigeria, without regard to its conflict of law principles. Any disputes not subject to arbitration shall be brought in the courts located in Lagos, Nigeria.</p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-ajo-ink mb-4">12. Contact Information</h2>
                <p className="mb-4">For questions, concerns, or notices regarding these Terms:</p>
                <div className="bg-ajo-surface-sunken p-6 rounded-card">
                  <p className="font-semibold text-ajo-ink">Ajo Platform</p>
                  <p>Email: <a href="mailto:roland.ayuk@digitalsmartenvironment.com" className="text-ajo-primary hover:underline">legal@digitalsmartenvironment.com</a></p>
                  <p>Support: <a href="mailto:roland.ayuk@digitalsmartenvironment.com" className="text-ajo-primary hover:underline">support@digitalsmartenvironment.com</a></p>
                  <p className="mt-2">No 1 Oguntolo street, Ijaiye, Lagos, Nigeria</p>
                  <p className="text-sm mt-2">We aim to respond to all inquiries within 5 business days.</p>
                </div>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-ajo-ink mb-4">13. Acknowledgment</h2>
                <div className="bg-ajo-primary-soft p-6 rounded-card border-l-4 border-ajo-primary">
                  <p className="font-semibold text-ajo-ink mb-2">BY USING AJO'S SERVICES, YOU ACKNOWLEDGE THAT YOU HAVE READ, UNDERSTOOD, AND AGREE TO BE BOUND BY THESE TERMS AND CONDITIONS, INCLUDING OUR PRIVACY POLICY.</p>
                  <p className="text-sm">If you do not agree to these Terms, you must not use our services.</p>
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