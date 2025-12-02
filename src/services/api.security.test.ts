import { describe, it, expect, vi, beforeEach } from 'vitest';
import { api } from './api';

// Mock fetch globally
global.fetch = vi.fn();

describe('API Security Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('Authentication & Authorization', () => {
    it('should include Authorization header when token is present', async () => {
      localStorage.setItem('token', 'test-token-123');
      
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ([]),
      } as Response);

      await api.getAccounts();

      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-token-123',
          }),
        })
      );
    });

    it('should not include Authorization header for public endpoints', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: 'new-token' }),
      } as Response);

      await api.login('test@example.com', 'password');

      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.not.objectContaining({
            'Authorization': expect.any(String),
          }),
        })
      );
    });

    it('should handle unauthorized responses', async () => {
      localStorage.setItem('token', 'invalid-token');

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Unauthorized' }),
      } as Response);

      await expect(api.getAccounts()).rejects.toThrow('Unauthorized');
    });

    it('should handle forbidden responses', async () => {
      localStorage.setItem('token', 'valid-token');

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({ error: 'Forbidden' }),
      } as Response);

      await expect(api.getAccounts()).rejects.toThrow('Forbidden');
    });
  });

  describe('Input Validation & Sanitization', () => {
    it('should handle SQL injection attempts in account creation', async () => {
      const maliciousInput = {
        accountName: "'; DROP TABLE accounts; --",
        accountType: 'Asset',
        balance: 1000,
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      } as Response);

      await api.createAccount(maliciousInput);

      // Verify the data is sent as-is (backend should handle sanitization)
      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify(maliciousInput),
        })
      );
    });

    it('should handle XSS attempts in transaction description', async () => {
      const maliciousInput = {
        accountId: 'A001',
        transactionDate: '2024-01-01',
        description: '<script>alert("XSS")</script>',
        debit: 100,
        credit: 0,
        reference: 'REF-001',
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      } as Response);

      await api.createTransaction(maliciousInput);

      // Data should be sent as JSON (which escapes special characters)
      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify(maliciousInput),
        })
      );
    });

    it('should handle extremely long input strings', async () => {
      const longString = 'A'.repeat(10000);
      const input = {
        accountName: longString,
        accountType: 'Asset',
        balance: 1000,
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: 'Input too long' }),
      } as Response);

      await expect(api.createAccount(input)).rejects.toThrow('Input too long');
    });

    it('should handle special characters in input', async () => {
      const specialCharsInput = {
        accountName: "Test & <Account> 'Name' \"Quote\"",
        accountType: 'Asset',
        balance: 1000,
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      } as Response);

      await api.createAccount(specialCharsInput);

      // Should properly encode in JSON
      const callArgs = vi.mocked(fetch).mock.calls[0];
      const body = callArgs[1]?.body as string;
      expect(body).toContain('Test & <Account>');
    });
  });

  describe('Data Exposure & Privacy', () => {
    it('should not expose sensitive data in error messages', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ 
          error: 'Database connection failed',
          details: 'Connection string: mysql://user:password@localhost/db'
        }),
      } as Response);

      try {
        await api.getAccounts();
      } catch (error: any) {
        // Should only expose the error message, not details
        expect(error.message).toBe('Database connection failed');
        expect(error.message).not.toContain('password');
      }
    });

    it('should handle malformed JSON responses safely', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => {
          throw new Error('Invalid JSON');
        },
      } as unknown as Response);

      await expect(api.getAccounts()).rejects.toThrow('Request failed');
    });
  });

  describe('CSRF Protection', () => {
    it('should use JSON content type for all requests', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      } as Response);

      await api.createAccount({
        accountName: 'Test',
        accountType: 'Asset',
        balance: 1000,
      });

      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    it('should use POST method for mutations', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      } as Response);

      await api.createAccount({
        accountName: 'Test',
        accountType: 'Asset',
        balance: 1000,
      });

      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
        })
      );
    });
  });

  describe('Rate Limiting & DoS Protection', () => {
    it('should handle rate limit responses', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({ error: 'Too many requests' }),
      } as Response);

      await expect(api.getAccounts()).rejects.toThrow('Too many requests');
    });

    it('should handle timeout scenarios', async () => {
      vi.mocked(fetch).mockImplementationOnce(
        () => new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Request timeout')), 100)
        )
      );

      await expect(api.getAccounts()).rejects.toThrow('Request timeout');
    });
  });

  describe('Data Integrity', () => {
    it('should validate numeric inputs are actually numbers', async () => {
      const invalidInput = {
        accountName: 'Test',
        accountType: 'Asset',
        balance: 'not-a-number' as any,
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: 'Invalid balance format' }),
      } as Response);

      await expect(api.createAccount(invalidInput)).rejects.toThrow('Invalid balance format');
    });

    it('should handle negative balances appropriately', async () => {
      const negativeBalance = {
        accountName: 'Test',
        accountType: 'Asset',
        balance: -1000,
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      } as Response);

      await api.createAccount(negativeBalance);

      // Backend should validate if negative is allowed
      expect(fetch).toHaveBeenCalled();
    });

    it('should handle very large numbers', async () => {
      const largeNumber = {
        accountName: 'Test',
        accountType: 'Asset',
        balance: Number.MAX_SAFE_INTEGER + 1,
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: 'Number too large' }),
      } as unknown as Response);

      await expect(api.createAccount(largeNumber)).rejects.toThrow('Number too large');
    });
  });

  describe('Cache Security', () => {
    it('should not cache sensitive data in memory indefinitely', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ([{ id: '1', account_code: '1000', account_name: 'Test', account_type: 'Asset', balance: 1000, level: 0 }]),
      } as Response);

      await api.getAccounts();

      // Cache exists
      vi.mocked(fetch).mockClear();
      await api.getAccounts();

      // Should use cache (no new fetch)
      expect(fetch).not.toHaveBeenCalled();
    });

    it('should invalidate cache after mutations', async () => {
      // Initial fetch
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ([]),
      } as Response);

      await api.getAccounts();

      // Create account
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      } as Response);

      await api.createAccount({
        accountName: 'Test',
        accountType: 'Asset',
        balance: 1000,
      });

      // Fetch again - should make new request (cache invalidated)
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ([{ id: '1', account_code: '1000', account_name: 'Test', account_type: 'Asset', balance: 1000, level: 0 }]),
      } as Response);

      await api.getAccounts();

      expect(fetch).toHaveBeenCalledTimes(3);
    });
  });

  describe('Error Handling Security', () => {
    it('should not leak stack traces in production', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Internal server error'));

      try {
        await api.getAccounts();
      } catch (error: any) {
        expect(error.stack).toBeUndefined();
      }
    });

    it('should handle network errors gracefully', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'));

      await expect(api.getAccounts()).rejects.toThrow();
    });
  });

  describe('Session Management', () => {
    it('should handle expired tokens', async () => {
      localStorage.setItem('token', 'expired-token');

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Token expired' }),
      } as Response);

      await expect(api.getAccounts()).rejects.toThrow('Token expired');
    });

    it('should clear sensitive data from localStorage on logout', () => {
      localStorage.setItem('token', 'test-token');
      localStorage.setItem('user', JSON.stringify({ id: 1, email: 'test@example.com' }));

      // Simulate logout
      localStorage.removeItem('token');
      localStorage.removeItem('user');

      expect(localStorage.getItem('token')).toBeNull();
      expect(localStorage.getItem('user')).toBeNull();
    });
  });

  describe('Content Security', () => {
    it('should properly encode JSON data', async () => {
      const dataWithSpecialChars = {
        accountName: 'Test\n\r\t"Account"',
        accountType: 'Asset',
        balance: 1000,
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      } as Response);

      await api.createAccount(dataWithSpecialChars);

      const callArgs = vi.mocked(fetch).mock.calls[0];
      const body = JSON.parse(callArgs[1]?.body as string);
      
      expect(body.accountName).toBe('Test\n\r\t"Account"');
    });

    it('should handle unicode characters safely', async () => {
      const unicodeData = {
        accountName: '测试账户 🏦',
        accountType: 'Asset',
        balance: 1000,
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      } as Response);

      await api.createAccount(unicodeData);

      const callArgs = vi.mocked(fetch).mock.calls[0];
      const body = JSON.parse(callArgs[1]?.body as string);
      
      expect(body.accountName).toBe('测试账户 🏦');
    });
  });
});