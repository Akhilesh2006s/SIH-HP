import crypto from 'crypto';
import CryptoJS from 'crypto-js';

export class EncryptionService {
  private static readonly ALGORITHM = 'aes-256-gcm';
  private static readonly KEY_LENGTH = 32;
  private static readonly IV_LENGTH = 16;
  private static readonly TAG_LENGTH = 16;

  // Generate a random encryption key
  static generateKey(): string {
    return crypto.randomBytes(this.KEY_LENGTH).toString('hex');
  }

  // Generate a random salt
  static generateSalt(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  // Hash email for storage
  static hashEmail(email: string): string {
    return crypto.createHash('sha256').update(email.toLowerCase()).digest('hex');
  }

  // Hash password with salt
  static async hashPassword(password: string, salt: string): Promise<string> {
    return new Promise((resolve, reject) => {
      crypto.pbkdf2(password, salt, 100000, 64, 'sha512', (err, derivedKey) => {
        if (err) reject(err);
        else resolve(derivedKey.toString('hex'));
      });
    });
  }

  // Verify password
  static async verifyPassword(password: string, hash: string, salt: string): Promise<boolean> {
    const hashedPassword = await this.hashPassword(password, salt);
    return hashedPassword === hash;
  }

  // Encrypt data using AES-256-GCM
  static encrypt(data: any, key: string): string {
    const iv = crypto.randomBytes(this.IV_LENGTH);
    const cipher = crypto.createCipher(this.ALGORITHM, key);
    cipher.setAAD(Buffer.from('smart-travel-diary', 'utf8'));

    let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const tag = cipher.getAuthTag();

    // Combine IV, tag, and encrypted data
    const combined = iv.toString('hex') + ':' + tag.toString('hex') + ':' + encrypted;
    return combined;
  }

  // Decrypt data using AES-256-GCM
  static decrypt(encryptedData: string, key: string): any {
    const parts = encryptedData.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted data format');
    }

    const iv = Buffer.from(parts[0], 'hex');
    const tag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];

    const decipher = crypto.createDecipher(this.ALGORITHM, key);
    decipher.setAAD(Buffer.from('smart-travel-diary', 'utf8'));
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return JSON.parse(decrypted);
  }

  // Generate HMAC signature
  static generateSignature(data: string, key: string): string {
    return crypto.createHmac('sha256', key).update(data).digest('hex');
  }

  // Verify HMAC signature
  static verifySignature(data: string, signature: string, key: string): boolean {
    const expectedSignature = this.generateSignature(data, key);
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  }

  // Encrypt trip data for storage
  static encryptTripData(trip: any, userKey: string): string {
    // Remove sensitive fields that shouldn't be encrypted
    const { user_id, created_at, updated_at, ...tripData } = trip;
    
    return this.encrypt(tripData, userKey);
  }

  // Decrypt trip data
  static decryptTripData(encryptedData: string, userKey: string): any {
    return this.decrypt(encryptedData, userKey);
  }

  // Generate pseudonymous user ID
  static generatePseudonymousUserId(email: string, salt: string): string {
    const hash = crypto.createHash('sha256')
      .update(email.toLowerCase() + salt)
      .digest('hex');
    
    // Convert to UUID format
    return [
      hash.substring(0, 8),
      hash.substring(8, 12),
      hash.substring(12, 16),
      hash.substring(16, 20),
      hash.substring(20, 32)
    ].join('-');
  }

  // Anonymize location data
  static anonymizeLocation(lat: number, lon: number, gridSizeMeters: number = 100): { lat: number; lon: number } {
    // Convert to meters (approximate)
    const latMeters = lat * 111320; // 1 degree latitude ≈ 111,320 meters
    const lonMeters = lon * 111320 * Math.cos(lat * Math.PI / 180);
    
    // Round to grid
    const roundedLatMeters = Math.floor(latMeters / gridSizeMeters) * gridSizeMeters;
    const roundedLonMeters = Math.floor(lonMeters / gridSizeMeters) * gridSizeMeters;
    
    // Convert back to degrees
    return {
      lat: roundedLatMeters / 111320,
      lon: roundedLonMeters / (111320 * Math.cos(lat * Math.PI / 180))
    };
  }

  // Round timestamp to time bin
  static roundToTimeBin(timestamp: string, binSizeMinutes: number = 5): string {
    const date = new Date(timestamp);
    const binSizeMs = binSizeMinutes * 60 * 1000;
    const roundedTime = new Date(Math.floor(date.getTime() / binSizeMs) * binSizeMs);
    return roundedTime.toISOString();
  }

  // Generate zone ID from coordinates
  static generateZoneId(lat: number, lon: number, gridSizeMeters: number = 100): string {
    const rounded = this.anonymizeLocation(lat, lon, gridSizeMeters);
    return `zone_${Math.round(rounded.lat * 1000000)}_${Math.round(rounded.lon * 1000000)}`;
  }

  // Add differential privacy noise
  static addDifferentialPrivacyNoise(value: number, epsilon: number = 1.0): number {
    // Laplace mechanism for differential privacy
    const sensitivity = 1; // For trip counts
    const scale = sensitivity / epsilon;
    const noise = -scale * Math.sign(Math.random() - 0.5) * Math.log(1 - 2 * Math.abs(Math.random() - 0.5));
    return Math.max(0, Math.round(value + noise));
  }

  // Secure random string generation
  static generateSecureRandom(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  // Hash sensitive data for logging (one-way)
  static hashForLogging(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex').substring(0, 8);
  }
}
