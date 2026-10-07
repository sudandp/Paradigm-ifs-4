/**
 * config/env.js
 * Centralized environment configuration and validation
 */

require('dotenv').config();

module.exports = {
  PORT: parseInt(process.env.PORT || '4000', 10),
  API_SECRET: process.env.API_SECRET || '',
  
  // Database Configuration
  DB_SERVER: process.env.DB_SERVER || 'localhost',
  DB_NAME: process.env.DB_NAME || 'etimetracklite1',
  DB_USER: process.env.DB_USER || 'sa',
  DB_PASSWORD: process.env.DB_PASSWORD || 'Paradigm@1610',
  DB_PORT: parseInt(process.env.DB_PORT || '1433', 10),
  DB_INSTANCE: process.env.DB_INSTANCE || 'SQLEXPRESS',
  DB_TRUSTED: process.env.DB_TRUSTED === 'true',

  // Optional eBioServer / WebAPIService endpoint
  EBIOSERVER_URL: process.env.EBIOSERVER_URL || 'http://localhost:81/WebAPIService.asmx',
  
  // Supabase Configuration
  SUPABASE_URL: process.env.SUPABASE_URL || 'https://fmyafuhxlorbafbacywa.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
};
