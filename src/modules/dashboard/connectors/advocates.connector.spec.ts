import { AdvocatesConnector } from './advocates.connector';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('AdvocatesConnector', () => {
  let connector: AdvocatesConnector;

  beforeEach(() => {
    connector = new AdvocatesConnector();
    jest.clearAllMocks();
  });

  describe('authenticate', () => {
    it('should authenticate successfully and return token', async () => {
      mockedAxios.post.mockResolvedValue({
        data: {
          data: {
            token: 'test-jwt-token',
            user: { id: 1, username: 'admin' },
          },
        },
      });

      const result = await connector.authenticate(
        'admin_adpro_dev',
        'AD_adpro_2022',
        'qa',
      );

      expect(result.token).toBe('test-jwt-token');
      expect(result.expiresAt).toBeGreaterThan(Date.now());
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://api.qa.advocatespro.com/login',
        { email: 'admin_adpro_dev', password: 'AD_adpro_2022', subdomain: 'qa' },
      );
    });

    it('should use cached token on second call', async () => {
      mockedAxios.post.mockResolvedValue({
        data: { data: { token: 'cached-token' } },
      });

      await connector.authenticate('user', 'pass', 'qa');
      const result = await connector.authenticate('user', 'pass', 'qa');

      expect(result.token).toBe('cached-token');
      expect(mockedAxios.post).toHaveBeenCalledTimes(1);
    });

    it('should throw on invalid credentials', async () => {
      mockedAxios.post.mockRejectedValue(new Error('Request failed with status 401'));

      await expect(
        connector.authenticate('bad-user', 'bad-pass', 'qa'),
      ).rejects.toThrow('ADVOCATES_AUTH_FAILED');
    });

    it('should throw when response has no token', async () => {
      mockedAxios.post.mockResolvedValue({
        data: { data: { user: {} } },
      });

      await expect(
        connector.authenticate('user', 'pass', 'qa'),
      ).rejects.toThrow('ADVOCATES_AUTH_FAILED');
    });
  });

  describe('getMetrics', () => {
    it('should fetch metrics successfully', async () => {
      const mockMetrics = {
        data: {
          acumulateValuation: '50718391.29',
          totalEngagement: 285,
          totalContent: 715,
        },
      };

      mockedAxios.get.mockResolvedValue({ data: mockMetrics });

      const result = await connector.getMetrics('test-token', 2026);

      expect(result).toEqual(mockMetrics);
      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://api.qa.advocatespro.com/get-metrics-dashboard-admin',
        {
          params: { typeFilter: 'all', year: 2026 },
          headers: { Authorization: 'Bearer test-token' },
        },
      );
    });

    it('should use current year if not provided', async () => {
      mockedAxios.get.mockResolvedValue({ data: {} });

      await connector.getMetrics('token');

      const call = mockedAxios.get.mock.calls[0];
      expect(call[1].params.year).toBe(new Date().getFullYear());
    });

    it('should throw on API error', async () => {
      mockedAxios.get.mockRejectedValue(new Error('Network error'));

      await expect(connector.getMetrics('token')).rejects.toThrow(
        'ADVOCATES_METRICS_FAILED',
      );
    });
  });
});
