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
