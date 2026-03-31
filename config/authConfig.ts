/**
 * authConfig.ts
 * 
 * Centralized authentication configuration for the Paradigm Office app.
 * This file serves as the permanent source of truth for Google Client IDs
 * and other authentication-related parameters.
 */

export const GOOGLE_CONFIG = {
  /**
   * The Google Web Client ID used for both native SocialLogin initialization
   * and the web fallback flow.
   * 
   * This value is permanent and source-controlled to ensure that APK builds
   * are consistent even if environment variables (.env.local) are missing.
   */
  clientId: "447552978158-gnvv87s9fhd41v5ci69v8j9irmmh8rl9.apps.googleusercontent.com",
  
  /**
   * The Android Package Name registered in the Google Cloud Console.
   */
  packageName: "com.paradigm.ifs",
};
