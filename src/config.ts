import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  host: process.env.HOST || '0.0.0.0',
  env: process.env.NODE_ENV || 'development',
  
  dbPath: process.env.DATABASE_PATH || path.join(rootDir, 'data', 'protokol.db'),
  uploadDir: process.env.UPLOAD_DIR || path.join(rootDir, 'data', 'uploads'),
  pdfDir: process.env.PDF_DIR || path.join(rootDir, 'data', 'pdfs'),
  dossierDir: process.env.DOSSIER_DIR || path.join(rootDir, 'data', 'dossiers'),
  
  hmacSecret: process.env.HMAC_SECRET || 'protokol_hmac_secret_2026',

  // PIN salt for technician/signer PIN hashing. Changing this invalidates all
  // existing PIN hashes, so in production a missing value only warns loudly
  // (there is no PIN-recovery flow by product decision).
  pinSalt: process.env.PIN_SALT || 'protokol_salt_2026',
  
  // WhatsApp Provider Settings (credentials from environment)
  whatsappChannel: process.env.WHATSAPP_CHANNEL || 'WHATSAPP_DEV',
  whatsappFallbackRecipient: process.env.WHATSAPP_RECIPIENT || '+51966000000',
  twilioAccountSid: process.env.TWILIO_ACCOUNT_SID || '',
  twilioAuthToken: process.env.TWILIO_AUTH_TOKEN || '',
  twilioFromNumber: process.env.TWILIO_FROM_NUMBER || '',
  
  // Default regional timezone fallback
  defaultTimezoneOffset: process.env.DEFAULT_TIMEZONE_OFFSET || '-05:00',
  defaultTimezoneName: process.env.DEFAULT_TIMEZONE_NAME || 'America/Lima',

  // Supabase Cloud Configuration
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseKey: process.env.SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || ''
};

// C-03 (2026-10-03): fail fast in production when the HMAC secret is not set.
// A predictable integrity secret makes every sealed hash forgeable. PIN_SALT
// intentionally only warns: rotating it invalidates all existing PIN hashes
// and the product has no PIN-recovery flow (decision: centralized project PIN,
// no change-password option).
if (config.env === 'production' && !process.env.HMAC_SECRET) {
  throw new Error(
    'FATAL: HMAC_SECRET is not set. Refusing to boot in production with a ' +
    'predictable default integrity secret. Set HMAC_SECRET in the environment.'
  );
}
if (config.env === 'production' && !process.env.PIN_SALT) {
  console.warn(
    '⚠️  SECURITY: PIN_SALT is not set; using the public default salt. ' +
    'Set PIN_SALT in production. Note: changing it later invalidates all existing PINs.'
  );
}
