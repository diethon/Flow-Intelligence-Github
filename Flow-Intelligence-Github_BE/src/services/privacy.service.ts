export class PrivacyService {
  /**
   * Apply all configured privacy rules to a payload based on PrivacySettings.
   */
  public applySettings(data: any, settings?: { pseudonymizeContributors?: boolean; excludeRawComments?: boolean; excludeRawCode?: boolean }): any {
    console.log("\n=================== 🛡️ [PRIVACY PIPELINE LOG] ===================");
    console.log("📥 ACTIVE PRIVACY SETTINGS:", JSON.stringify(settings || {}, null, 2));
    console.log("🔍 [BEFORE] RAW PAYLOAD:");
    console.log(JSON.stringify(data, null, 2));

    let payload = this.redact(data);

    if (settings?.excludeRawComments) {
      payload = this.excludeComments(payload);
    }

    if (settings?.excludeRawCode) {
      payload = this.excludeCode(payload);
    }

    if (settings?.pseudonymizeContributors) {
      payload = this.pseudonymize(payload);
    }

    console.log("🔒 [AFTER] SANITIZED PAYLOAD SENT TO AI:");
    console.log(JSON.stringify(payload, null, 2));
    console.log("=================================================================\n");

    return payload;
  }

  /**
   * Exclude raw comment bodies from object payload.
   */
  public excludeComments(data: any): any {
    if (Array.isArray(data)) {
      return data.map((item) => this.excludeComments(item));
    }

    if (data !== null && typeof data === "object") {
      const result: any = {};
      for (const [key, value] of Object.entries(data)) {
        const lowerKey = key.toLowerCase();
        if (lowerKey.includes("comment") || lowerKey === "body" || lowerKey.includes("reviewbody")) {
          result[key] = "[RAW_COMMENTS_EXCLUDED]";
        } else {
          result[key] = this.excludeComments(value);
        }
      }
      return result;
    }

    return data;
  }

  /**
   * Exclude raw source code diffs/snippets from object payload.
   */
  public excludeCode(data: any): any {
    if (Array.isArray(data)) {
      return data.map((item) => this.excludeCode(item));
    }

    if (data !== null && typeof data === "object") {
      const result: any = {};
      for (const [key, value] of Object.entries(data)) {
        const lowerKey = key.toLowerCase();
        if (lowerKey.includes("diff") || lowerKey.includes("patch") || lowerKey.includes("code") || lowerKey.includes("snippet")) {
          result[key] = "[RAW_CODE_EXCLUDED]";
        } else {
          result[key] = this.excludeCode(value);
        }
      }
      return result;
    }

    return data;
  }

  /**
   * Pseudonymize names/identifiers in a string or object.
   */
  public pseudonymize(data: any): any {
    if (typeof data === "string") {
      // Basic pseudonymization for demonstration
      return data.replace(/([A-Z][a-z]+ [A-Z][a-z]+)/g, "User_$1_Hash");
    }
    
    if (Array.isArray(data)) {
      return data.map((item) => this.pseudonymize(item));
    }
    
    if (data !== null && typeof data === "object") {
      const result: any = {};
      for (const [key, value] of Object.entries(data)) {
        if (key.toLowerCase().includes("name") || key.toLowerCase() === "author") {
          result[key] = typeof value === "string" ? `User_${this.hashString(value)}` : this.pseudonymize(value);
        } else {
          result[key] = this.pseudonymize(value);
        }
      }
      return result;
    }
    
    return data;
  }

  /**
   * Redact sensitive information like PII, emails, passwords, tokens.
   */
  public redact(data: any): any {
    if (typeof data === "string") {
      let redacted = data;
      // Redact emails
      redacted = redacted.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "[REDACTED_EMAIL]");
      // Redact phone numbers (simple pattern)
      redacted = redacted.replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, "[REDACTED_PHONE]");
      // Redact tokens/passwords (heuristics)
      redacted = redacted.replace(/(password|token|secret|key)["']?\s*[:=]\s*["']?[^\s"']+["']?/gi, "$1: [REDACTED]");
      return redacted;
    }
    
    if (Array.isArray(data)) {
      return data.map((item) => this.redact(item));
    }
    
    if (data !== null && typeof data === "object") {
      const result: any = {};
      for (const [key, value] of Object.entries(data)) {
        const lowerKey = key.toLowerCase();
        if (
          lowerKey.includes("password") ||
          lowerKey.includes("email") ||
          lowerKey.includes("phone") ||
          lowerKey.includes("token") ||
          lowerKey.includes("address") ||
          lowerKey.includes("userid") ||
          lowerKey.includes("user_id") ||
          lowerKey.includes("auth") ||
          lowerKey === "id" ||
          lowerKey === "_id"
        ) {
          result[key] = "[REDACTED]";
        } else {
          result[key] = this.redact(value);
        }
      }
      return result;
    }
    
    return data;
  }

  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString(16);
  }
}

