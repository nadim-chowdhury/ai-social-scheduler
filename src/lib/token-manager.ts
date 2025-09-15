import crypto from "crypto";

const ENCRYPTION_KEY = process.env.TOKEN_ENCRYPTION_KEY || crypto.randomBytes(32).toString("hex");
const ALGORITHM = "aes-256-gcm";

export class TokenManager {
  /**
   * Encrypt sensitive token data
   */
  static encrypt(text: string): string {
    try {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipher(ALGORITHM, ENCRYPTION_KEY);
      cipher.setAAD(iv);
      
      let encrypted = cipher.update(text, "utf8", "hex");
      encrypted += cipher.final("hex");
      
      const authTag = cipher.getAuthTag();
      
      return iv.toString("hex") + ":" + authTag.toString("hex") + ":" + encrypted;
    } catch (error) {
      console.error("Token encryption error:", error);
      throw new Error("Failed to encrypt token");
    }
  }

  /**
   * Decrypt sensitive token data
   */
  static decrypt(encryptedText: string): string {
    try {
      const parts = encryptedText.split(":");
      if (parts.length !== 3) {
        throw new Error("Invalid encrypted token format");
      }

      const iv = Buffer.from(parts[0], "hex");
      const authTag = Buffer.from(parts[1], "hex");
      const encrypted = parts[2];

      const decipher = crypto.createDecipher(ALGORITHM, ENCRYPTION_KEY);
      decipher.setAAD(iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encrypted, "hex", "utf8");
      decrypted += decipher.final("utf8");

      return decrypted;
    } catch (error) {
      console.error("Token decryption error:", error);
      throw new Error("Failed to decrypt token");
    }
  }

  /**
   * Generate a secure state parameter for OAuth flows
   */
  static generateState(workspaceId: string, userId: string): string {
    const timestamp = Date.now();
    const random = crypto.randomBytes(16).toString("hex");
    return Buffer.from(`${workspaceId}:${userId}:${timestamp}:${random}`).toString("base64");
  }

  /**
   * Validate and parse state parameter
   */
  static parseState(state: string): { workspaceId: string; userId: string; timestamp: number } | null {
    try {
      const decoded = Buffer.from(state, "base64").toString("utf8");
      const parts = decoded.split(":");
      
      if (parts.length !== 4) {
        return null;
      }

      const [workspaceId, userId, timestamp] = parts;
      const stateTime = parseInt(timestamp);
      
      // Check if state is not older than 10 minutes
      if (Date.now() - stateTime > 10 * 60 * 1000) {
        return null;
      }

      return { workspaceId, userId, timestamp: stateTime };
    } catch (error) {
      console.error("State parsing error:", error);
      return null;
    }
  }
}
