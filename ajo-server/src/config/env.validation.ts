import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().default(5010),

  // No credentials in source — always supply MONGODB_URI through the
  // environment (local .env or the host's env vars). The default below is a
  // shape-only placeholder and cannot connect anywhere.
  MONGODB_URI: Joi.string().default(
    'mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/vtu?retryWrites=true&w=majority',
  ),

  // JWT
  // No credentials in source — supply JWT_ACCESS_SECRET through the
  // environment. Generate one with:  openssl rand -hex 32
  JWT_ACCESS_SECRET: Joi.string().default('change-this-to-a-long-random-string'),
  JWT_ACCESS_EXPIRES_IN: Joi.string().default('7d'),

  // Termii
  // No credentials in source — supply TERMII_API_KEY through the environment.
  TERMII_API_KEY: Joi.string().default('your-termii-api-key'),
  TERMII_SENDER_ID: Joi.string().default('OE Alert'),
  TERMII_BASE_URL: Joi.string().default('https://v4.api.termii.com/'),

  //https://api.ng.termii.com/
  // Paystack (wallet funding + payouts)
  //
  // Deliberately has NO default. This used to fall back to a committed test
  // key that Paystack has since revoked, so every payment call failed with
  // `Invalid key` and it looked like an application bug. Leave it unset when
  // payments are not needed: PaystackService detects the missing key at boot
  // (warning) and returns an actionable 503 from payment endpoints.
  PAYSTACK_SECRET_KEY: Joi.string().allow('').optional(),
  PAYSTACK_BASE_URL: Joi.string().default('https://api.paystack.co'),
  // Test-mode transfer OTP. Paystack normally sends this to the email/phone
  // registered on the dashboard account; some test accounts accept only the
  // code that was actually delivered (not the historical 123456).
  PAYSTACK_TRANSFER_OTP: Joi.string().default('123456'),
  // Dedicated Virtual Account (DVA) — lets members fund their wallet by bank
  // transferring into a personal virtual account number. DVA must be enabled
  // on the Paystack business (Settings > Payment channels). Values are
  // Paystack `provider_slug`s, NOT bank names: wema-bank (live), providus,
  // sterling, titan-paystack. The service asks
  // `/dedicated_account/available_providers` which ones this business can
  // actually use, and falls back through the rest rather than failing on
  // `Invalid bank` / `... is not available in test mode`.
  PAYSTACK_DVA_PREFERRED_BANK: Joi.string().default('wema-bank'),
  WALLET_CURRENCY: Joi.string().default('NGN'),

  // Firebase Admin (push notifications). Optional — if omitted, push is
  // skipped and only SMS/in-app notifications are recorded.
  FIREBASE_PROJECT_ID: Joi.string().default('ma-project-497415'),
  FIREBASE_CLIENT_EMAIL: Joi.string().default(
    'blog-reader@ma-project-497415.iam.gserviceaccount.com',
  ),
  FIREBASE_PRIVATE_KEY: Joi.string().default(
    '-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQC1vL677cL0AjPm\nGcWrIyIOMnZivXY/t+IBwyfBlpOVMShbpiQOxrpm4o592FFmmmDJlwk0lQQFs0wR\niTeS+5+LlWl3D+I1jhftItOOi21Hf6ahHPJh8+4rQRsR/VuOETxttVnqHvRJxecR\n9oTzSH6nWUxO+EofAT3BKEFK4Dk8so6JfN5QeAq4JNYrBr5u7xafhDFueYoIENM5\nTrvBjOgEWw/LTgcjtZffaBENXBlKnBVRk/9sVVl22fjsD7Y9Nuu++tm4pl4S5GZv\n0vEW4NwKSxRdlyWNzcxBnvkoJHFkOiV4tDeUpa6jy/j5zu0xLkm6HcnjLfRKh6yE\njJVQwmMfAgMBAAECggEAK7prhlpyMzYoeLAw0LnWYuYfeCiwQCqlldj4QutRPW+j\nj1HNkUSd602ODZe0FmUE7tyJmX5Vhm2a2wlSNuqWfAaKZtyKiGpVNXjQwJapx69e\nT5vgclM4Nm4m7lAw7GEXUip1pRCnpOyaaccQPF1wJCIna0TwyL8KteRSuYp0GzdP\nlSo7+4030A4CHLsvxEKCki1D1DffA0JbdmR2uhq597Iu5NPxl/38m+biLTgoMU53\n35yrHvYIwjMwUxRlv8yt06O4XRTKmNh783v5TsvSkEyx+HnrLQmAD+0BuZ7EAXpG\nnUuVManCKbXkj47d/62RmfJC/ILoOA2B3xqKiBD7qQKBgQDgY3beItr66LKPjikG\ndHJvLG9bkCgTYsAPGH7EJgQvQeJxovCwOPohryS9+hRm4DXDyeZ8qi4tgci8BzgE\nv8S0gmjByU8bUpbOoIur4UIYIHlYi6UcM3jTgpW437cEnYdPZ34P1wFZ4l6n9ER/\natkvvmVOGpsayKfz1N1AOJHVwwKBgQDPVxILUYVOEJTmq/m3A212InKnYazsmklN\nhhmSbPdsPXoFRz67GbBdJAOm6HLGu8nEc684P6RsrhNCNuVIxmmqk6Sd66c0Plh1\nBRi60KgLpq+Wn9Tq7irf0c1Nng5MKEdlQu8rql9an/NoeRcTEHtchQiFJ4e/7C5c\nrRSoOI17dQKBgHRxCSlDGzHjeW3njsCLwyqP+4WfbDyLHTF4O6hcNgW0AeeIb7Bz\nENJUChQP53BvX1cnudTtlyMEW3+/m0FTpqcpmWUeq095b0rwoyphraPJjk71wIu+\n5i+Ub0/NwDLD8IizIwbjQw862nX722PntacB/Z4nTl/6yrVMvDfsYzlzAoGAWs05\n9MT9yUNPwnmcQb75iBvr9Eu9bFzhL1dECbE45ilCL9+UpGHKr++evdDcuxXwdd1n\n5g1RF9tgScY6wZVLH03LcPGL50BKguz5eI76mSeljCRxHXWyRxTdgVlvz4BwS/N1\nRL03Rzv3YFBvf4TfUZRdN9spAy8O2r1d55HkvCUCgYAP7eM3oxtu2jNBpx3cZ4BQ\nSay+ix7DsiBzCwC25U2dshGRB8oLz7Um5uOqcF4TWEDeuyLNcgkLm8w4Sd5MVG2D\nVPOMW/ojOZavW9R5W2uYE67vr/8foNIvmrUFowGribqIPqHY34OydozdRTZbiVuL\nNVWH0ZQVxq9V0f4zN4Kjfw==\n-----END PRIVATE KEY-----\n',
  ),

  // OTP behaviour
  OTP_LENGTH: Joi.number().default(6),
  OTP_EXPIRY_MINUTES: Joi.number().default(10),
  OTP_MAX_ATTEMPTS: Joi.number().default(5),

  // VTpass (bill payments — the only VTU provider)
  //
  // Deliberately has NO defaults. Committed key pairs here went stale and made
  // every bills endpoint fail with VTpass' opaque "087 INVALID CREDENTIALS",
  // which looks like an application bug. Leave them blank when bills are not
  // needed: VTPassService warns at boot and BillsService answers 503 naming the
  // missing variables (same pattern as PAYSTACK_SECRET_KEY above).
  VTPASS_API_KEY: Joi.string().allow('').optional(),
  VTPASS_PUBLIC_KEY: Joi.string().allow('').optional(),
  VTPASS_SECRET_KEY: Joi.string().allow('').optional(),
  VTPASS_BASE_URL: Joi.string().default('https://vtpass.com/api/'),

  // Cron jobs (Vercel Cron, see vercel.json)
  // Shared secret Vercel sends as `Authorization: Bearer <CRON_SECRET>` on
  // every cron invocation; the guarded /cron/* endpoints verify it. The SAME
  // value must exist here and in the Vercel project env vars. Generate with:
  //   openssl rand -hex 32
  CRON_SECRET: Joi.string().default(''),
  // When cron jobs are driven by Vercel Cron, set to 'true' to stop the
  // in-process @nestjs/schedule jobs from also firing (prevents duplicate
  // debits/notifications on serverless deployments). Keep 'false' on an
  // always-on host where the in-process scheduler is the only trigger.
  DISABLE_IN_PROCESS_CRONS: Joi.string()
    .valid('true', 'false')
    .default('false'),

  // Seed script
  SEED_PLATFORM_ADMIN_EMAIL: Joi.string().email().default('admin@ajo.app'),
  // No credentials in source — supply SEED_PLATFORM_ADMIN_PASSWORD through the
  // environment when running `npm run seed:platform-admin`.
  SEED_PLATFORM_ADMIN_PASSWORD: Joi.string()
    .min(8)
    .default('change-this-strong-password'),
  SEED_PLATFORM_ADMIN_PHONE: Joi.string().default('+2347068497569'),
});
