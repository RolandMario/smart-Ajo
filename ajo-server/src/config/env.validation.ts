import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().default(5010),

  MONGODB_URI: Joi.string().default(
    'mongodb+srv://rolandmario2_db_user:5SuYb5yK4k8wVAsQ@ajo.pkwzfdc.mongodb.net/?appName=Ajo',
  ),

  // JWT
  JWT_ACCESS_SECRET: Joi.string().default(
    'e4d254a0c30b53c696301eb758d3a5f69f9d69f405992ccb26ed5d0e3460b177',
  ),
  JWT_ACCESS_EXPIRES_IN: Joi.string().default('7d'),

  // Termii
  TERMII_API_KEY: Joi.string().default(
    'TLeWnCGAOlasJpRQHvJHBuvEJMdOpmgYMmcaNHNBmNXGWBXhzleuBEhNeVdSOt',
  ),
  TERMII_SENDER_ID: Joi.string().default('OE Alert'),
  TERMII_BASE_URL: Joi.string().default('https://v4.api.termii.com/'),

  //https://api.ng.termii.com/
  // Paystack (wallet funding + payouts)
  PAYSTACK_SECRET_KEY: Joi.string().default(
    'sk_test_f6436553a3e96c17fd447658dbde28b42ed70af7',
  ),
  PAYSTACK_BASE_URL: Joi.string().default('https://api.paystack.co'),
  // Test-mode transfer OTP. Paystack normally sends this to the email/phone
  // registered on the dashboard account; some test accounts accept only the
  // code that was actually delivered (not the historical 123456).
  PAYSTACK_TRANSFER_OTP: Joi.string().default('123456'),
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

  // VTpass (bill payments)
  VTPASS_API_KEY: Joi.string().default('55e5a3a8edce6f92723a167859022d26'),
  VTPASS_PUBLIC_KEY: Joi.string().default(
    'PK_6969d551a403295f897a14822ef19bfeb0b258de4ba',
  ),
  VTPASS_SECRET_KEY: Joi.string().default(
    'SK_849175d0d558b1e3038ca57341d05611786b5874d24',
  ),
  VTPASS_BASE_URL: Joi.string().default('https://vtpass.com/api/'),

  // Gladtidings (bill payments — second provider)
  GLADTIDINGS_API_KEY: Joi.string().default(
    '019471cb4ca75dee7de39307aed863dcc2282fef',
  ),
  GLADTIDINGS_BASE_URL: Joi.string().default(
    'https://www.gladtidingsdata.com/api/',
  ),

  // Seed script
  SEED_PLATFORM_ADMIN_EMAIL: Joi.string().email().default('admin@ajo.app'),
  SEED_PLATFORM_ADMIN_PASSWORD: Joi.string().min(8).default('r@landMari@123'),
  SEED_PLATFORM_ADMIN_PHONE: Joi.string().default('+2347068497569'),
});
