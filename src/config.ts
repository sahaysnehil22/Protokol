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
  
  hmacSecret: process.env.HMAC_SECRET || 'protokol_ayacucho_pilot_hmac_secret_2026',
  
  // Pilot Project Settings
  pilotProjectId: 'AY-728-001',
  pilotProjectName: 'Mejoramiento y Ampliación de Transitabilidad AY-728 a AY-729',
  pilotContractNumber: 'N° 81-2026-GRA-SEDECENTRAL-OAPF',
  pilotEntity: 'Gobierno Regional de Ayacucho',
  pilotExecutionMode: 'Administración Directa',
  
  // WhatsApp Notification Settings
  whatsappChannel: process.env.WHATSAPP_CHANNEL || 'WHATSAPP_DEV',
  whatsappRecipient: process.env.WHATSAPP_RECIPIENT || '+51966000000', // David Valdez Ochoa (Quality Specialist)
  twilioAccountSid: process.env.TWILIO_ACCOUNT_SID || '',
  twilioAuthToken: process.env.TWILIO_AUTH_TOKEN || '',
  twilioFromNumber: process.env.TWILIO_FROM_NUMBER || '',
  
  // Project Timezone
  projectTimezoneOffset: '-05:00', // Peru Time (PET / UTC-5)
  projectTimezoneName: 'America/Lima'
};
