import request from 'supertest';
import { app } from '../src/app';
import { linkedInService } from '../src/services/linkedin.service';

describe('Profile API Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /health', () => {
    it('should return 200 OK with timestamp', async () => {
      const response = await request(app).get('/health');
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('ok');
    });
  });

  describe('POST /api/v1/profile', () => {
    it('should return 400 Bad Request when url parameter is missing', async () => {
      const response = await request(app).post('/api/v1/profile').send({});
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Bad Request');
    });

    it('should return 400 Validation Error for invalid URL format', async () => {
      const response = await request(app).post('/api/v1/profile').send({ url: 'not-a-valid-url' });
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation Error');
    });

    it('should return structured profile data on successful fetch', async () => {
      const mockProfile = {
        vanityId: 'testuser',
        profileUrl: 'https://www.linkedin.com/in/testuser/',
        fullName: 'Test User',
        firstName: 'Test',
        lastName: 'User',
        headline: 'Software Engineer',
        location: 'San Francisco, CA',
        about: 'Passionate developer.',
        profilePicture: 'https://example.com/pic.jpg',
        backgroundPicture: '',
        experiences: [
          {
            title: 'Senior Developer',
            companyName: 'Tech Corp',
            locationName: 'San Francisco, CA',
            endDate: 'Present',
          },
        ],
        education: [
          {
            schoolName: 'Stanford University',
            degreeName: 'B.S.',
            fieldOfStudy: 'Computer Science',
          },
        ],
        skills: [{ name: 'TypeScript' }, { name: 'Node.js' }],
        certifications: [],
        languages: [{ name: 'English', proficiency: 'Native' }],
      };

      jest.spyOn(linkedInService, 'fetchProfile').mockResolvedValue(mockProfile as any);

      const response = await request(app)
        .post('/api/v1/profile')
        .send({ url: 'https://www.linkedin.com/in/testuser/' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.fullName).toBe('Test User');
      expect(response.body.data.experiences).toHaveLength(1);
    });
  });
});
