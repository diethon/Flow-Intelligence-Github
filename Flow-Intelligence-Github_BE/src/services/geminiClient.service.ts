import { GoogleGenAI } from "@google/genai";

/**
 * GeminiClientService manages a pool of Gemini API keys and automatically
 * rotates to the next key when the current one hits quota limits or errors.
 *
 * Keys are loaded from:
 *  1. GEMINI_API_KEYS (comma-separated list) — preferred
 *  2. GEMINI_API_KEY (single key) — fallback for backward compatibility
 */
export class GeminiClientService {
  private static instance: GeminiClientService;

  /** Ordered list of all API keys available */
  private readonly apiKeys: string[];

  /** Index of the currently active key */
  private currentIndex = 0;

  private constructor() {
    const keysFromEnv = process.env.GEMINI_API_KEYS;
    const singleKey = process.env.GEMINI_API_KEY;

    if (keysFromEnv) {
      // Parse comma-separated list, trim whitespace, filter empty/placeholder strings
      this.apiKeys = keysFromEnv
        .split(",")
        .map((k) => k.trim())
        .filter(
          (k) =>
            k.length > 0 &&
            k !== "YOUR_SECOND_GEMINI_KEY" &&
            k !== "YOUR_THIRD_GEMINI_KEY"
        );
    } else if (singleKey) {
      this.apiKeys = [singleKey];
    } else {
      this.apiKeys = [];
    }

    if (this.apiKeys.length === 0) {
      console.warn(
        "[GeminiClient] No valid API keys found. AI features will use fallback."
      );
    } else {
      console.log(
        `[GeminiClient] Loaded ${this.apiKeys.length} API key(s).`
      );
    }
  }

  /** Singleton accessor */
  public static getInstance(): GeminiClientService {
    if (!GeminiClientService.instance) {
      GeminiClientService.instance = new GeminiClientService();
    }
    return GeminiClientService.instance;
  }

  /** Returns true if at least one key is available */
  public hasKeys(): boolean {
    return this.apiKeys.length > 0;
  }

  /**
   * Attempts to call the Gemini API using the current key.
   * On quota/invalid-key errors it rotates to the next key and retries.
   * Throws when all keys are exhausted.
   */
  public async generateContent(params: {
    model: string;
    contents: string;
    config?: Record<string, unknown>;
  }): Promise<{ text: string }> {
    if (!this.hasKeys()) {
      throw new Error("No Gemini API keys configured.");
    }

    const totalKeys = this.apiKeys.length;
    let attempts = 0;

    // Try each key at most once per request
    while (attempts < totalKeys) {
      const key = this.apiKeys[this.currentIndex];

      try {
        const ai = new GoogleGenAI({ apiKey: key });
        const response = await ai.models.generateContent({
          model: params.model,
          contents: params.contents,
          config: params.config,
        });

        // Success — return the text
        return { text: response.text ?? "" };
      } catch (error: any) {
        const isQuotaError = this.isQuotaOrKeyError(error);
        const keyLabel = `key[${this.currentIndex + 1}/${totalKeys}]`;

        if (isQuotaError) {
          console.warn(
            `[GeminiClient] ${keyLabel} hit quota/auth error: ${error.message}. Rotating to next key...`
          );
          this.rotateKey();
          attempts++;
        } else {
          // Non-quota errors (network, bad prompt, etc.) — rethrow immediately
          throw error;
        }
      }
    }

    throw new Error(
      `[GeminiClient] All ${totalKeys} Gemini API key(s) exhausted or invalid. No more keys to try.`
    );
  }

  /** Advance to the next key in a round-robin fashion */
  private rotateKey(): void {
    this.currentIndex = (this.currentIndex + 1) % this.apiKeys.length;
  }

  /**
   * Detects quota-exceeded or invalid-key errors from Gemini API responses.
   * HTTP 429 = Too Many Requests (quota), 401/403 = auth issues.
   */
  private isQuotaOrKeyError(error: any): boolean {
    if (!error) return false;

    const message: string = (error.message ?? "").toLowerCase();
    const status: number = error.status ?? error.statusCode ?? error.code ?? 0;

    const quotaKeywords = [
      "quota",
      "rate limit",
      "too many requests",
      "resource exhausted",
      "invalid api key",
      "api key not valid",
      "permission denied",
    ];

    const isQuotaStatus = status === 429 || status === 401 || status === 403;
    const isQuotaMessage = quotaKeywords.some((kw) =>
      message.includes(kw)
    );

    return isQuotaStatus || isQuotaMessage;
  }
}
