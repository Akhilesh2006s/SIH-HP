import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import CryptoJS from 'crypto-js';

// Encryption utilities for client-side data protection
export class EncryptionService {
  private static readonly KEY_STORAGE_KEY = 'user_encryption_key';
  private static readonly SALT_STORAGE_KEY = 'user_encryption_salt';
  
  // Generate a new encryption key for the user
  static async generateUserKey(): Promise<string> {
    const key = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      `${Date.now()}-${Math.random()}`,
      { encoding: Crypto.CryptoEncoding.BASE64 }
    );
    return key;
  }
  
  // Store encryption key securely
  static async storeUserKey(key: string): Promise<void> {
    await SecureStore.setItemAsync(this.KEY_STORAGE_KEY, key);
  }
  
  // Retrieve encryption key
  static async getUserKey(): Promise<string | null> {
    return await SecureStore.getItemAsync(this.KEY_STORAGE_KEY);
  }
  
  // Generate salt for key derivation
  static async generateSalt(): Promise<string> {
    const salt = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      `${Date.now()}-${Math.random()}`,
      { encoding: Crypto.CryptoEncoding.BASE64 }
    );
    return salt;
  }
  
  // Store salt securely
  static async storeSalt(salt: string): Promise<void> {
    await SecureStore.setItemAsync(this.SALT_STORAGE_KEY, salt);
  }
  
  // Retrieve salt
  static async getSalt(): Promise<string | null> {
    return await SecureStore.getItemAsync(this.SALT_STORAGE_KEY);
  }
  
  // Derive key from password using PBKDF2
  static deriveKeyFromPassword(password: string, salt: string): string {
    return CryptoJS.PBKDF2(password, salt, {
      keySize: 256 / 32,
      iterations: 10000
    }).toString();
  }
  
  // Encrypt data using AES-256-GCM
  static encrypt(data: any, key: string): string {
    const jsonString = JSON.stringify(data);
    const encrypted = CryptoJS.AES.encrypt(jsonString, key).toString();
    return encrypted;
  }
  
  // Decrypt data using AES-256-GCM
  static decrypt(encryptedData: string, key: string): any {
    const decrypted = CryptoJS.AES.decrypt(encryptedData, key);
    const jsonString = decrypted.toString(CryptoJS.enc.Utf8);
    return JSON.parse(jsonString);
  }
  
  // Generate HMAC signature for data integrity
  static generateSignature(data: string, key: string): string {
    return CryptoJS.HmacSHA256(data, key).toString();
  }
  
  // Verify HMAC signature
  static verifySignature(data: string, signature: string, key: string): boolean {
    const expectedSignature = this.generateSignature(data, key);
    return expectedSignature === signature;
  }
  
  // Encrypt trip data for server transmission
  static async encryptTripForSync(trip: any): Promise<{
    encrypted_data: string;
    signature: string;
  }> {
    const userKey = await this.getUserKey();
    if (!userKey) {
      throw new Error('User encryption key not found');
    }
    
    const encryptedData = this.encrypt(trip, userKey);
    const signature = this.generateSignature(encryptedData, userKey);
    
    return {
      encrypted_data: encryptedData,
      signature: signature
    };
  }
  
  // Decrypt trip data from server
  static async decryptTripFromSync(encryptedData: string, signature: string): Promise<any> {
    const userKey = await this.getUserKey();
    if (!userKey) {
      throw new Error('User encryption key not found');
    }
    
    // Verify signature first
    if (!this.verifySignature(encryptedData, signature, userKey)) {
      throw new Error('Data integrity check failed');
    }
    
    return this.decrypt(encryptedData, userKey);
  }
  
  // Generate pseudonymous user ID
  static async generatePseudonymousUserId(email: string): Promise<string> {
    const salt = await this.getSalt() || await this.generateSalt();
    if (!await this.getSalt()) {
      await this.storeSalt(salt);
    }
    
    const hash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      `${email}-${salt}`,
      { encoding: Crypto.CryptoEncoding.HEX }
    );
    
    // Convert to UUID format for consistency
    return `${hash.substring(0, 8)}-${hash.substring(8, 12)}-${hash.substring(12, 16)}-${hash.substring(16, 20)}-${hash.substring(20, 32)}`;
  }
  
  // Hash password for storage
  static async hashPassword(password: string): Promise<string> {
    const salt = await this.generateSalt();
    const hash = CryptoJS.PBKDF2(password, salt, {
      keySize: 256 / 32,
      iterations: 100000
    }).toString();
    
    return `${salt}:${hash}`;
  }
  
  // Verify password
  static async verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
    const [salt, hash] = hashedPassword.split(':');
    const computedHash = CryptoJS.PBKDF2(password, salt, {
      keySize: 256 / 32,
      iterations: 100000
    }).toString();
    
    return computedHash === hash;
  }
  
  // Clear all encryption data (for logout/data deletion)
  static async clearEncryptionData(): Promise<void> {
    await SecureStore.deleteItemAsync(this.KEY_STORAGE_KEY);
    await SecureStore.deleteItemAsync(this.SALT_STORAGE_KEY);
  }
}

// Utility functions for data anonymization
export class AnonymizationUtils {
  // Round timestamp to nearest time bin
  static roundToTimeBin(timestamp: string, binSizeMinutes: number): string {
    const date = new Date(timestamp);
    const binSizeMs = binSizeMinutes * 60 * 1000;
    const roundedTime = new Date(Math.floor(date.getTime() / binSizeMs) * binSizeMs);
    return roundedTime.toISOString();
  }
  
  // Round coordinates to grid
  static roundToGrid(lat: number, lon: number, gridSizeMeters: number): { lat: number; lon: number } {
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
  
  // Generate zone ID from coordinates
  static generateZoneId(lat: number, lon: number, gridSizeMeters: number): string {
    const rounded = this.roundToGrid(lat, lon, gridSizeMeters);
    return `zone_${Math.round(rounded.lat * 1000000)}_${Math.round(rounded.lon * 1000000)}`;
  }
  
  // Add noise to sensitive data for differential privacy
  static addDifferentialPrivacyNoise(value: number, epsilon: number = 1.0): number {
    // Laplace mechanism for differential privacy
    const sensitivity = 1; // For trip counts
    const scale = sensitivity / epsilon;
    const noise = -scale * Math.sign(Math.random() - 0.5) * Math.log(1 - 2 * Math.abs(Math.random() - 0.5));
    return Math.max(0, Math.round(value + noise));
  }
}


