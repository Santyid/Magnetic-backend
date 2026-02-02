import { ConfigService } from '@nestjs/config';
import { EncryptionService } from './encryption.service';

describe('EncryptionService', () => {
  let service: EncryptionService;
  const testKey = 'a'.repeat(64); // 64 hex chars = 32 bytes

  beforeEach(() => {
    const configService = {
      get: jest.fn().mockReturnValue(testKey),
    } as unknown as ConfigService;
    service = new EncryptionService(configService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should encrypt and decrypt a string correctly', () => {
    const plaintext = 'AD_adpro_2022';
    const encrypted = service.encrypt(plaintext);
    const decrypted = service.decrypt(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it('should produce different ciphertexts for the same plaintext (random IV)', () => {
    const plaintext = 'test-password';
    const encrypted1 = service.encrypt(plaintext);
    const encrypted2 = service.encrypt(plaintext);
    expect(encrypted1).not.toBe(encrypted2);
  });

  it('should produce ciphertext in iv:authTag:data format', () => {
    const encrypted = service.encrypt('hello');
    const parts = encrypted.split(':');
    expect(parts.length).toBe(3);
    // IV = 16 bytes = 32 hex chars
    expect(parts[0].length).toBe(32);
    // AuthTag = 16 bytes = 32 hex chars
    expect(parts[1].length).toBe(32);
    // Encrypted data should be non-empty
    expect(parts[2].length).toBeGreaterThan(0);
  });

  it('should handle empty strings', () => {
    const encrypted = service.encrypt('');
    const decrypted = service.decrypt(encrypted);
    expect(decrypted).toBe('');
  });

  it('should handle special characters', () => {
    const plaintext = '!@#$%^&*()_+{}:"<>?/\\español中文';
    const encrypted = service.encrypt(plaintext);
    const decrypted = service.decrypt(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it('should throw on invalid encryption key length', () => {
    const configService = {
      get: jest.fn().mockReturnValue('short-key'),
    } as unknown as ConfigService;
    expect(() => new EncryptionService(configService)).toThrow(
      'CREDENTIALS_ENCRYPTION_KEY must be a 64-character hex string',
    );
  });

  it('should throw on null encryption key', () => {
    const configService = {
      get: jest.fn().mockReturnValue(null),
    } as unknown as ConfigService;
    expect(() => new EncryptionService(configService)).toThrow();
  });

  it('should fail to decrypt tampered ciphertext', () => {
    const encrypted = service.encrypt('secret');
    const parts = encrypted.split(':');
    // Tamper with the encrypted data
    parts[2] = 'ff' + parts[2].slice(2);
    const tampered = parts.join(':');
    expect(() => service.decrypt(tampered)).toThrow();
  });
});
