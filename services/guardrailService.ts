/**
 * Paradigm Assist — Production Security Guardrails & Rate Limiter
 *
 * Implements:
 * 1. Prompt Injection & Jailbreak Defense (OWASP LLM01)
 * 2. System Prompt & Credential Leakage Shield (OWASP LLM06)
 * 3. SQL / Command Injection Sanitizer
 * 4. Token Bucket Rate Limiter (Max 15 queries / minute with rolling cooldown)
 */

export interface GuardrailCheckResult {
  isSafe: boolean;
  reason?: 'prompt_injection' | 'jailbreak_attempt' | 'sql_injection' | 'rate_limited' | 'content_violation';
  userMessage?: string;
  cooldownRemainingSeconds?: number;
}

class GuardrailService {
  private static instance: GuardrailService;

  // Rate Limiter Configuration: 15 queries per 60 seconds
  private readonly RATE_LIMIT_MAX = 15;
  private readonly RATE_LIMIT_WINDOW_MS = 60 * 1000;
  private userQueryTimestamps: Map<string, number[]> = new Map();

  // Adversarial & Jailbreak Patterns (Case-insensitive matching)
  private readonly JAILBREAK_PATTERNS = [
    /ignore\s+(all\s+)?(previous|prior|above)\s+(instructions|directives|prompts|rules)/i,
    /you\s+are\s+now\s+(in\s+)?(developer|dan|unrestricted|god|jailbroken|sudo)\s+mode/i,
    /disregard\s+(your\s+)?(instructions|guidelines|programming|system\s+prompt)/i,
    /repeat\s+(everything|the\s+entire|all)\s+system\s+(prompt|instructions|directive)/i,
    /print\s+(the\s+)?(system\s+prompt|initial\s+prompt|developer\s+instructions)/i,
    /what\s+are\s+your\s+(exact\s+)?(instructions|rules|initial\s+prompt|system\s+prompt)/i,
    /pretend\s+you\s+have\s+no\s+(rules|limits|safety|restrictions)/i,
    /output\s+(your\s+)?source\s+code/i,
    /show\s+me\s+your\s+system\s+prompt/i,
    /bypass\s+(all\s+)?(filters|security|safety)/i,
    /act\s+as\s+an\s+unfiltered\s+ai/i
  ];

  // SQL / System Command Injection Patterns
  private readonly INJECTION_PATTERNS = [
    /drop\s+table\s+/i,
    /delete\s+from\s+[a-z_]+/i,
    /union\s+select\s+/i,
    /insert\s+into\s+[a-z_]+/i,
    /;\s*--/i,
    /<script\b[^>]*>/i,
    /javascript:\s*/i
  ];

  // Sensitive Internal Strings that must NEVER be returned to the client
  private readonly SENSITIVE_OUTPUT_SCRUBBERS = [
    /eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/g, // JWT tokens
    /gsk_[a-zA-Z0-9]{20,}/g, // Groq API keys
    /sbp_[a-zA-Z0-9]{20,}/g, // Supabase service keys
    /postgresql:\/\/[^@\s]+@[^\s]+/gi, // DB connection strings
    /api_key\s*=\s*['"][^'"]+['"]/gi
  ];

  private constructor() {}

  public static getInstance(): GuardrailService {
    if (!GuardrailService.instance) {
      GuardrailService.instance = new GuardrailService();
    }
    return GuardrailService.instance;
  }

  /**
   * Evaluates an incoming user query against rate limits and adversarial checks.
   * Returns isSafe = true if allowed to proceed to intent classifier.
   */
  public inspectInput(query: string, userId: string = 'anonymous_user'): GuardrailCheckResult {
    const trimmed = query.trim();
    if (!trimmed) {
      return { isSafe: true };
    }

    // 1. Rate Limiting Check
    const rateCheck = this.checkRateLimit(userId);
    if (!rateCheck.isSafe) {
      return rateCheck;
    }

    // 2. Jailbreak & Prompt Injection Check
    for (const pattern of this.JAILBREAK_PATTERNS) {
      if (pattern.test(trimmed)) {
        return {
          isSafe: false,
          reason: 'prompt_injection',
          userMessage: 'I cannot process prompt override requests. How can I assist you with Paradigm facility operations?'
        };
      }
    }

    // 3. SQL / Command Injection Check
    for (const pattern of this.INJECTION_PATTERNS) {
      if (pattern.test(trimmed)) {
        return {
          isSafe: false,
          reason: 'sql_injection',
          userMessage: 'Security check: SQL or script execution commands are not permitted. Please ask your question in natural language.'
        };
      }
    }

    return { isSafe: true };
  }

  /**
   * Post-generation sanitizer — scrubs any accidental leaks of API keys, DB strings, or tokens.
   */
  public sanitizeOutput(text: string): string {
    let sanitized = text;

    for (const scrubber of this.SENSITIVE_OUTPUT_SCRUBBERS) {
      sanitized = sanitized.replace(scrubber, '[REDACTED_CREDENTIAL]');
    }

    // Mask internal database names from ever reaching users
    sanitized = sanitized
      .replace(/\bsupabase\b/gi, 'Enterprise Cloud Directory')
      .replace(/\bessl\b/gi, 'Biometric Hardware Engine')
      .replace(/\bmssql\b/gi, 'Access Control System')
      .replace(/\betimetracklite\b/gi, 'Attendance Hardware Gateway');

    return sanitized;
  }

  /**
   * Sliding window rate limiter: Max 15 queries per 60 seconds
   */
  private checkRateLimit(userId: string): GuardrailCheckResult {
    const now = Date.now();
    const timestamps = this.userQueryTimestamps.get(userId) || [];

    // Filter out timestamps older than 60 seconds
    const validTimestamps = timestamps.filter(ts => now - ts < this.RATE_LIMIT_WINDOW_MS);

    if (validTimestamps.length >= this.RATE_LIMIT_MAX) {
      const oldestValid = validTimestamps[0];
      const remainingSeconds = Math.max(1, Math.ceil((this.RATE_LIMIT_WINDOW_MS - (now - oldestValid)) / 1000));

      return {
        isSafe: false,
        reason: 'rate_limited',
        cooldownRemainingSeconds: remainingSeconds,
        userMessage: `You have reached the maximum query limit (${this.RATE_LIMIT_MAX} queries/minute). Please wait ${remainingSeconds} second${remainingSeconds > 1 ? 's' : ''} before asking your next question.`
      };
    }

    // Record this query
    validTimestamps.push(now);
    this.userQueryTimestamps.set(userId, validTimestamps);

    return { isSafe: true };
  }

  /**
   * Resets rate limits for testing or admin sessions
   */
  public resetRateLimit(userId?: string): void {
    if (userId) {
      this.userQueryTimestamps.delete(userId);
    } else {
      this.userQueryTimestamps.clear();
    }
  }
}

export const guardrailService = GuardrailService.getInstance();
