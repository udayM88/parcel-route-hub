// Shared environment configuration for edge functions
// The environment is passed from the frontend via request headers

export type Environment = 'sandbox' | 'production';

interface PrayogConfig {
  apiBaseUrl: string;
  serviceabilityBaseUrl?: string;
  tenantIdEnvVar: string;
  apiKeyEnvVar: string;
}

interface RazorpayConfig {
  keyIdEnvVar: string;
  keySecretEnvVar: string;
}

export const PRAYOG_CONFIG: Record<Environment, PrayogConfig> = {
  sandbox: {
    apiBaseUrl: 'https://sandbox-apis.prayog.io',
    tenantIdEnvVar: 'PRAYOG_TENANT_ID',
    apiKeyEnvVar: 'PRAYOG_API_KEY',
  },
  production: {
    apiBaseUrl: 'https://apis.prayog.io',
    serviceabilityBaseUrl: 'https://prod-apis.prayog.io',
    tenantIdEnvVar: 'PRAYOG_PROD_TENANT_ID',
    apiKeyEnvVar: 'PRAYOG_PROD_API_KEY',
  },
};

export const RAZORPAY_CONFIG: Record<Environment, RazorpayConfig> = {
  sandbox: {
    keyIdEnvVar: 'RAZORPAY_KEY_ID',
    keySecretEnvVar: 'RAZORPAY_KEY_SECRET',
  },
  production: {
    keyIdEnvVar: 'RAZORPAY_PROD_KEY_ID',
    keySecretEnvVar: 'RAZORPAY_PROD_KEY_SECRET',
  },
};

export function getEnvironmentFromRequest(req: Request): Environment {
  const envHeader = req.headers.get('x-environment');
  if (envHeader === 'production') {
    return 'production';
  }
  return 'sandbox'; // Default to sandbox
}

export function getPrayogConfig(env: Environment) {
  const config = PRAYOG_CONFIG[env];
  return {
    apiBaseUrl: config.apiBaseUrl,
    serviceabilityBaseUrl: config.apiBaseUrl, // Now uses gateway on main API URL
    tenantId: Deno.env.get(config.tenantIdEnvVar),
    apiKey: Deno.env.get(config.apiKeyEnvVar),
  };
}

export function getRazorpayConfig(env: Environment) {
  const config = RAZORPAY_CONFIG[env];
  return {
    keyId: Deno.env.get(config.keyIdEnvVar),
    keySecret: Deno.env.get(config.keySecretEnvVar),
  };
}

interface ShadowfaxConfig {
  apiBaseUrl: string;
  tokenEnvVar: string;
}

export const SHADOWFAX_CONFIG: Record<Environment, ShadowfaxConfig> = {
  sandbox: {
    apiBaseUrl: 'https://dale.staging.shadowfax.in',
    tokenEnvVar: 'SHADOWFAX_STAGING_TOKEN',
  },
  production: {
    apiBaseUrl: 'https://dale.shadowfax.in',
    tokenEnvVar: 'SHADOWFAX_PROD_TOKEN',
  },
};

export function getShadowfaxConfig(env: Environment) {
  const config = SHADOWFAX_CONFIG[env];
  return {
    apiBaseUrl: config.apiBaseUrl,
    token: Deno.env.get(config.tokenEnvVar),
  };
}

interface DelhiveryConfig {
  apiBaseUrl: string;
  tokenEnvVar: string;
  warehouseEnvVar: string;
}

// Note: user has only a live token. We point sandbox at the staging URL but
// fall back to the prod token if the staging secret is not set, so the function
// works in both environments without two separate credentials.
export const DELHIVERY_CONFIG: Record<Environment, DelhiveryConfig> = {
  sandbox: {
    apiBaseUrl: 'https://staging-express.delhivery.com',
    tokenEnvVar: 'DELHIVERY_STAGING_TOKEN',
    warehouseEnvVar: 'DELHIVERY_CLIENT_WAREHOUSE_NAME',
  },
  production: {
    apiBaseUrl: 'https://track.delhivery.com',
    tokenEnvVar: 'DELHIVERY_PROD_TOKEN',
    warehouseEnvVar: 'DELHIVERY_PROD_CLIENT_WAREHOUSE_NAME',
  },
};

export function getDelhiveryConfig(env: Environment) {
  const config = DELHIVERY_CONFIG[env];
  const primary = Deno.env.get(config.tokenEnvVar);
  const warehouse =
    Deno.env.get(config.warehouseEnvVar) ||
    Deno.env.get('DELHIVERY_PROD_CLIENT_WAREHOUSE_NAME') ||
    Deno.env.get('DELHIVERY_CLIENT_WAREHOUSE_NAME');
  if (primary) {
    return { apiBaseUrl: config.apiBaseUrl, token: primary, warehouse };
  }
  // Fallback: use prod token + prod URL if env-specific token not configured
  const fallback = Deno.env.get('DELHIVERY_PROD_TOKEN');
  return {
    apiBaseUrl: DELHIVERY_CONFIG.production.apiBaseUrl,
    token: fallback,
    warehouse,
  };
}

interface UrbaneboltConfig {
  apiBaseUrl: string;
  usernameEnvVar: string;
  passwordEnvVar: string;
}

// User has only PROD credentials. Sandbox env falls back to PROD creds against
// the UAT base URL so testing still works without separate UAT credentials.
export const URBANEBOLT_CONFIG: Record<Environment, UrbaneboltConfig> = {
  sandbox: {
    apiBaseUrl: 'https://uat.urbanebolt.in',
    usernameEnvVar: 'URBANEBOLT_UAT_USERNAME',
    passwordEnvVar: 'URBANEBOLT_UAT_PASSWORD',
  },
  production: {
    apiBaseUrl: 'https://api.urbanebolt.in',
    usernameEnvVar: 'URBANEBOLT_PROD_USERNAME',
    passwordEnvVar: 'URBANEBOLT_PROD_PASSWORD',
  },
};

export function getUrbaneboltConfig(env: Environment) {
  const config = URBANEBOLT_CONFIG[env];
  const username =
    Deno.env.get(config.usernameEnvVar) || Deno.env.get('URBANEBOLT_PROD_USERNAME');
  const password =
    Deno.env.get(config.passwordEnvVar) || Deno.env.get('URBANEBOLT_PROD_PASSWORD');
  // Per Urbanebolt support: UAT customer code = UEBCUS0008, Prod = UBC0235.
  // Allow override via env-specific secrets, otherwise fall back to known values.
  const customerCode =
    (env === 'production'
      ? Deno.env.get('URBANEBOLT_PROD_CUSTOMER_CODE')
      : Deno.env.get('URBANEBOLT_UAT_CUSTOMER_CODE')) ||
    Deno.env.get('URBANEBOLT_CUSTOMER_CODE') ||
    (env === 'production' ? 'UBC0235' : 'UEBCUS0008');
  return {
    apiBaseUrl: config.apiBaseUrl,
    username,
    password,
    customerCode,
  };
}

interface XpressbeesConfig {
  apiBaseUrl: string;
  emailEnvVar: string;
  passwordEnvVar: string;
}

// XpressBees franchise B2C API has only one base URL (no UAT). Both env keys
// fall back to PROD credentials so sandbox testing still works.
export const XPRESSBEES_CONFIG: Record<Environment, XpressbeesConfig> = {
  sandbox: {
    apiBaseUrl: 'https://ship.xpressbees.com',
    emailEnvVar: 'XPRESSBEES_PROD_EMAIL',
    passwordEnvVar: 'XPRESSBEES_PROD_PASSWORD',
  },
  production: {
    apiBaseUrl: 'https://ship.xpressbees.com',
    emailEnvVar: 'XPRESSBEES_PROD_EMAIL',
    passwordEnvVar: 'XPRESSBEES_PROD_PASSWORD',
  },
};

export function getXpressbeesConfig(env: Environment) {
  const config = XPRESSBEES_CONFIG[env];
  return {
    apiBaseUrl: config.apiBaseUrl,
    email: Deno.env.get(config.emailEnvVar),
    password: Deno.env.get(config.passwordEnvVar),
  };
}

interface ShreeMarutiConfig {
  apiBaseUrl: string;
  emailEnvVar: string;
  passwordEnvVar: string;
}

// Shree Maruti uses the Innofulfill / Delcaper API platform.
// Login returns a JWT (1d access token, 30d refresh).
export const SHREE_MARUTI_CONFIG: Record<Environment, ShreeMarutiConfig> = {
  sandbox: {
    apiBaseUrl: 'https://sandbox.apis.innofulfill.com',
    emailEnvVar: 'SHREE_MARUTI_STAGING_EMAIL',
    passwordEnvVar: 'SHREE_MARUTI_STAGING_PASSWORD',
  },
  production: {
    apiBaseUrl: 'https://apis.innofulfill.com',
    emailEnvVar: 'SHREE_MARUTI_PROD_EMAIL',
    passwordEnvVar: 'SHREE_MARUTI_PROD_PASSWORD',
  },
};

export function getShreeMarutiConfig(env: Environment) {
  const config = SHREE_MARUTI_CONFIG[env];
  // Never let sandbox traffic silently authenticate with production credentials.
  const email = Deno.env.get(config.emailEnvVar);
  const password = Deno.env.get(config.passwordEnvVar);
  const vendorType = Deno.env.get('SHREE_MARUTI_VENDOR_TYPE') || 'SELLER';
  return {
    apiBaseUrl: config.apiBaseUrl,
    email,
    password,
    vendorType,
  };
}
