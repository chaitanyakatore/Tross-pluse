import { linkedInService } from '../src/services/linkedin.service';

describe('LinkedInService Unit Tests', () => {
  describe('extractVanityId', () => {
    it('should extract vanity ID from full HTTPS profile URL', () => {
      const url = 'https://www.linkedin.com/in/satyanadella/';
      expect(linkedInService.extractVanityId(url)).toBe('satyanadella');
    });

    it('should extract vanity ID from URL without trailing slash', () => {
      const url = 'https://www.linkedin.com/in/satyanadella';
      expect(linkedInService.extractVanityId(url)).toBe('satyanadella');
    });

    it('should extract vanity ID from URL without scheme', () => {
      const url = 'linkedin.com/in/satyanadella';
      expect(linkedInService.extractVanityId(url)).toBe('satyanadella');
    });

    it('should handle raw vanity string directly', () => {
      const input = 'satyanadella';
      expect(linkedInService.extractVanityId(input)).toBe('satyanadella');
    });
  });

  describe('getHeaders formatting (via CSRF token logic)', () => {
    it('should strip surrounding quotes from JSESSIONID when forming csrf-token', () => {
      const getHeadersMethod = (linkedInService as any)['getHeaders'].bind(linkedInService);
      const headers = getHeadersMethod('mock_li_at', '"ajax:123456789"');

      expect(headers['csrf-token']).toBe('ajax:123456789');
      expect(headers['x-restli-protocol-version']).toBe('2.0.0');
      expect(headers['Cookie']).toContain('li_at=mock_li_at');
      expect(headers['Cookie']).toContain('JSESSIONID="ajax:123456789"');
    });
  });
});
