# Privacy Policy

**Last Updated:** July 2, 2026  
**Effective Date:** July 2, 2026

## 1. Introduction

Ajo ("we," "our," or "us") is a digital thrift-collection (esusu/ajo) platform that enables users to create or join savings groups, contribute in rotating cycles, and manage payments through our mobile application and web services. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our platform.

We are committed to protecting your privacy and ensuring the security of your personal information. This policy applies to all users of our services, including:
- **ajo-mobile**: Our member-facing mobile application
- **ajo-server**: Our backend API services
- **ajo-admin-web**: Our internal platform administration console

## 2. Information We Collect

### 2.1 Personal Information

**Account Information:**
- **Phone Number**: Your primary identifier (required, stored in E.164 format)
- **Email Address**: Optional, used for account recovery and notifications
- **Full Name**: Optional, used for personalization
- **Password**: Only for platform administrators (hashed, never stored in plaintext)

**Authentication Data:**
- One-Time Passwords (OTPs): Generated for login verification, hashed and auto-expired
- JWT Tokens: Session tokens with minimal payload (user ID, role, phone, email)
- Device Tokens: Firebase Cloud Messaging (FCM) tokens for push notifications

### 2.2 Financial Information

**Wallet Data:**
- Wallet balance and transaction history
- Funding transactions (top-ups via Paystack)
- Contribution debits and refunds
- Transaction references and statuses

**Bank Account Details:**
- Bank name and code
- Account number (masked in admin views as ****1234)
- Paystack transfer recipient codes
- Payout history and status

**Payment Information:**
- Paystack transaction references
- Transfer initiation and confirmation records
- Failed/reversed payment attempts with failure reasons

### 2.3 Group and Social Information

**Group Membership:**
- Group names and settings
- Your role in groups (admin/member)
- Invitation status and history
- Rotation order and position
- Contribution status (pending/paid/defaulted)
- Historical default count

**Group Activity:**
- Cycle participation and contribution history
- Payout status and records
- Group creation and management actions

### 2.4 Technical and Usage Data

**Device Information:**
- Mobile platform (iOS/Android)
- Device tokens for notifications
- App version and usage patterns

**Log Data:**
- API request timestamps and endpoints accessed
- IP addresses (for security and rate limiting)
- Authentication attempts and outcomes
- Error logs and system events

## 3. How We Use Your Information

### 3.1 Core Service Delivery

**Authentication & Account Management:**
- Verify your identity via OTP (SMS) or email/password (admins)
- Create and manage your user account
- Maintain secure sessions via JWT tokens
- Enable password reset and account recovery

**Payment Processing:**
- Process wallet funding via Paystack payment links
- Automatically debit contributions from your wallet
- Initiate payouts to recipients via bank transfer
- Maintain transaction records and audit trails

**Group Management:**
- Create and administer savings groups
- Send and manage group invitations
- Track contributions and rotation cycles
- Calculate and enforce contribution due dates

**Notifications:**
- Send push notifications via Firebase Cloud Messaging
- Deliver SMS notifications for critical events (invites, payouts, urgent reminders)
- Maintain in-app notification inbox
- Schedule automated contribution reminders

### 3.2 Security and Fraud Prevention

- Authenticate and authorize all API requests
- Detect and prevent unauthorized access
- Monitor for suspicious activity
- Enforce rate limiting and abuse prevention
- Maintain audit logs of administrative actions

### 3.3 Service Improvement

- Debug and troubleshoot technical issues
- Analyze usage patterns to improve user experience
- Test new features and functionality
- Monitor system performance and reliability

## 4. Third-Party Services

### 4.1 Payment Processing (Paystack)

We use Paystack for payment processing. When you fund your wallet or receive payouts:
- Paystack collects your payment card details and processes transactions
- We receive transaction confirmations and references
- Paystack's privacy policy governs their data collection: [https://paystack.com/privacy](https://paystack.com/privacy)

**Data Shared with Paystack:**
- Email address (for payment receipts)
- Amount and currency
- Bank account details (for payouts only)
- Transaction references

### 4.2 SMS Services (Termii)

We use Termii for SMS delivery of OTPs and notifications:
- Termii sends SMS messages to your phone number
- We receive delivery confirmations and failure notifications
- Termii's privacy policy governs their data collection: [https://termii.com/privacy](https://termii.com/privacy)

**Data Shared with Termii:**
- Phone number (recipient)
- Message content (OTP codes, notification text)
- Sender ID

### 4.3 Push Notifications (Firebase Cloud Messaging)

We use Firebase Cloud Messaging (FCM) for push notifications:
- FCM delivers notifications to your device
- We register and manage device tokens
- Google's privacy policy governs their data collection: [https://policies.google.com/privacy](https://policies.google.com/privacy)

**Data Shared with Firebase:**
- Device token
- Notification payload (title, body, data)
- Platform (iOS/Android)

## 5. Data Storage and Security

### 5.1 Data Storage

**Database (MongoDB):**
- All user data is stored in MongoDB with Mongoose schemas
- OTP codes are hashed using bcrypt with TTL indexes for auto-expiry
- Passwords (admin only) are hashed using bcrypt
- Financial transactions are immutable once confirmed

**Token Storage:**
- Mobile app: Tokens stored in device Keychain/Keystore via expo-secure-store
- Admin web: Tokens stored in httpOnly cookies (never accessible to client-side JavaScript)
- In-memory cache for synchronous token reads

### 5.2 Security Measures

**Encryption:**
- All API communications use HTTPS/TLS
- JWT tokens are signed and verified
- Webhook signatures verified using constant-time comparison
- Sensitive data (bank account numbers) masked in admin views

**Access Controls:**
- Role-based access (user vs. platform_admin)
- Group-level permissions (isGroupAdmin flag)
- JWT re-verification on every request
- Immediate deactivation of compromised accounts

**Infrastructure:**
- CORS configuration (currently open, should be restricted in production)
- Rate limiting on authentication endpoints
- Input validation and sanitization
- SQL/NoSQL injection prevention

## 6. Data Sharing and Disclosure

### 6.1 Within the Platform

**Group Members:**
- Your name, phone number, and contribution status are visible to group members
- Your position in the rotation order is visible to group members
- Your payout status is visible when you are the current recipient

**Platform Administrators:**
- Admins can view all user profiles, wallet balances, and group memberships
- Admins can view masked bank account numbers (****1234)
- Admins can view all financial transactions and payout history
- Admin actions are logged with timestamps and actor information

### 6.2 External Disclosures

We do not sell, trade, or rent your personal information to third parties. We may disclose your information only in the following circumstances:

**Legal Requirements:**
- To comply with applicable laws, regulations, or legal processes
- To respond to government or regulatory requests
- To protect our rights, property, or safety, or that of our users

**Business Transfers:**
- In connection with a merger, acquisition, or sale of assets
- You will be notified via email and/or prominent notice on our platform

**Service Providers:**
- Third-party vendors who assist in operating our platform (Paystack, Termii, Firebase)
- These providers are contractually obligated to protect your data

## 7. Your Rights and Choices

### 7.1 Account Management

**Access and Update:**
- View your profile information via the app
- Update your name and email address
- Add or update your bank account for payouts

**Account Deletion:**
- Contact us to request account deletion
- We will delete your personal data within 30 days
- Financial transaction records may be retained for legal compliance

### 7.2 Notification Preferences

**Push Notifications:**
- Manage notification permissions in your device settings
- Disable specific notification types in-app

**SMS Notifications:**
- Critical notifications (invites, payouts) include SMS by default
- Contact support to opt out of non-critical SMS notifications

### 7.3 Data Portability

- Request a copy of your personal data in JSON format
- Includes profile, wallet transactions, group memberships, and notification history
- We will provide this within 30 days of verified request

### 7.4 Opt-Out Rights

- You may opt out of non-essential notifications
- You may request deletion of your account and associated data
- You may object to processing of your data for direct marketing (not applicable - we do not market)

## 8. Data Retention

### 8.1 Active Users

- Account data retained for the duration of your account activity
- Financial transaction records retained for 7 years (legal requirement)
- Notification history retained for 90 days
- OTP records auto-deleted after 15 minutes via TTL index

### 8.2 Inactive Users

- Accounts with no activity for 24 months may be archived
- Archived accounts can be restored upon request within 12 months
- After 12 months of archiving, accounts may be permanently deleted

### 8.3 Deleted Users

- Personal data deleted within 30 days of account deletion request
- Anonymized transaction records retained for 7 years (legal compliance)
- Audit logs retained for 3 years

## 9. Children's Privacy

Our services are not intended for users under the age of 18. We do not knowingly collect personal information from children. If we become aware that a child has provided us with personal information, we will delete it immediately. Parents or guardians who believe their child has provided us with information should contact us.

## 10. International Data Transfers

Your information may be transferred to and processed in countries other than your country of residence, including Nigeria and potentially other jurisdictions where our service providers operate. These countries may have data protection laws that differ from those in your country.

**Current Infrastructure:**
- Primary data storage: Nigeria (MongoDB Atlas)
- Payment processing: Paystack (Nigeria/pan-African)
- SMS delivery: Termii (Nigeria)
- Push notifications: Firebase (global)

We ensure appropriate safeguards are in place for international transfers, including:
- Standard contractual clauses
- Adequacy decisions by relevant authorities
- Your explicit consent where required

## 11. Cookies and Tracking

### 11.1 Admin Web (ajo-admin-web)

- Session cookies (httpOnly) for authentication
- No third-party tracking cookies
- No advertising or analytics cookies

### 11.2 Mobile App (ajo-mobile)

- No cookies used
- Local storage for token caching (secure storage)
- No third-party tracking SDKs

## 12. Breach Notification

In the event of a data breach that compromises your personal information:

**Our Commitment:**
- Notify affected users within 72 hours of discovery
- Notify the Nigeria Data Protection Commission (NDPC) as required by law
- Provide details of the breach, data affected, and remediation steps
- Offer guidance on protective measures you can take

**What We Will Notify You About:**
- Breaches involving financial data (wallet, bank accounts)
- Breaches involving authentication credentials
- Breaches affecting 10 or more users

## 13. Changes to This Policy

We may update this Privacy Policy from time to time. We will notify you of material changes by:

- Posting the updated policy on our website
- Updating the "Last Updated" date
- Sending an in-app notification or email (for significant changes)

Your continued use of our services after changes become effective constitutes acceptance of the updated policy. We encourage you to review this policy periodically.

## 14. Contact Information

For privacy-related inquiries, requests, or complaints:

**Data Protection Officer**  
Ajo Platform  
Email: privacy@ajo.app  
Phone: +234-XXX-XXXX-XXX

**Physical Address:**  
[Company Address]  
Lagos, Nigeria

**Response Time:**  
We aim to respond to all privacy requests within 30 days. Complex requests may take up to 60 days, and we will notify you if an extension is needed.

## 15. Complaints and Disputes

If you have a complaint about our privacy practices:

1. Contact us at privacy@ajo.app
2. We will investigate and respond within 30 days
3. If unsatisfied, you may lodge a complaint with the Nigeria Data Protection Commission (NDPC): https://ndpc.gov.ng

## 16. Additional Disclosures

### 16.1 Automated Decision-Making

We do not use automated decision-making or profiling that produces legal or similarly significant effects. Contribution default status is determined by simple date-based rules (due date passed, status still pending), not by algorithmic profiling.

### 16.2 Data Minimization

We collect only the data necessary to provide our services:
- Phone number is required for authentication
- Email is optional but recommended for account recovery
- Bank details only collected when needed for payouts
- No unnecessary personal data is collected or retained

### 16.3 Purpose Limitation

We use your data only for the purposes described in this policy:
- No marketing use of your data
- No sale or rental of your data to third parties
- No use of data for unrelated purposes without your consent

## 17. Definitions

**Personal Data**: Any information relating to an identified or identifiable natural person.

**Processing**: Any operation performed on personal data (collection, storage, use, disclosure, deletion).

**Data Subject**: The individual whose personal data is being processed (you, the user).

**Data Controller**: Ajo Platform, determining the purposes and means of processing personal data.

**Data Processor**: Third-party service providers processing data on our behalf (Paystack, Termii, Firebase).

**Consent**: Freely given, specific, informed, and unambiguous indication of your agreement to processing.

---

## Summary of Data Practices

| Data Category | Collected | Purpose | Shared With | Retention |
|---------------|-----------|---------|-------------|-----------|
| Phone Number | Yes (required) | Authentication, group membership | Group members, admins | Account lifetime + 7 years (anonymized) |
| Email | Optional | Account recovery, notifications | Paystack (receipts) | Account lifetime |
| Name | Optional | Personalization | Group members | Account lifetime |
| Wallet Balance | Yes | Payment processing | User only (masked in admin) | 7 years |
| Bank Account | Optional | Payout processing | Paystack only | Until removed + 7 years |
| Group Activity | Yes | Service delivery | Group members, admins | Account lifetime |
| Device Tokens | Yes | Push notifications | Firebase only | Until revoked |
| Transaction History | Yes | Audit, accounting | User, admins | 7 years |

---

**Acknowledgment:** By using Ajo's services, you acknowledge that you have read and understood this Privacy Policy and consent to the collection, use, and disclosure of your information as described herein.

**Questions?** If you have any questions about this Privacy Policy, please contact us at privacy@ajo.app.