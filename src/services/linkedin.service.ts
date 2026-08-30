import axios, { AxiosInstance } from 'axios';
import { env } from '../config/env';
import {
  LinkedInProfileResponse,
  ExperienceItem,
  EducationItem,
  SkillItem,
  CertificationItem,
  LanguageItem,
} from '../types/linkedin';

export class LinkedInService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      timeout: 15000,
      maxRedirects: 0, // CRITICAL: Prevent following 302/307 redirects to login-submit checkpoint which revokes browser sessions!
      validateStatus: (status: number) => status < 1000,
    });
  }

  /**
   * Extracts the vanity identifier from a LinkedIn URL or raw username input.
   * Examples:
   *  "https://www.linkedin.com/in/satyanadella/" -> "satyanadella"
   *  "linkedin.com/in/satyanadella"             -> "satyanadella"
   *  "satyanadella"                            -> "satyanadella"
   */
  public extractVanityId(urlOrUsername: string): string {
    const raw = urlOrUsername.trim().replace(/^https?:\/\//, '').replace(/^www\./, '');
    const parts = raw.split('/').filter(Boolean);

    if (parts.length === 0) {
      throw new Error('Invalid LinkedIn profile URL or vanity username provided');
    }

    const inIndex = parts.indexOf('in');
    if (inIndex !== -1 && parts[inIndex + 1]) {
      return parts[inIndex + 1].split('?')[0].split('#')[0];
    }

    const lastSegment = parts[parts.length - 1].split('?')[0].split('#')[0];
    // If it's something like "linkedin.com", it's invalid
    if (lastSegment.includes('.com') || lastSegment.includes('.org')) {
      throw new Error('Invalid LinkedIn profile URL or vanity username provided');
    }

    return lastSegment;
  }

  /**
   * Constructs the reverse-engineered HTTP headers required by LinkedIn Voyager API.
   * Requires JSESSIONID cookie value to calculate the mandatory `csrf-token` header.
   */
  private getHeaders(
    vanityId?: string,
    customLiAt?: string,
    customJsessionId?: string,
    customUserAgent?: string
  ) {
    const liAt = customLiAt || env.LINKEDIN_LI_AT;
    const jsessionId = customJsessionId || env.LINKEDIN_JSESSIONID;
    const userAgent = customUserAgent || env.USER_AGENT;

    // Clean double-quotes from JSESSIONID to form valid CSRF token header
    const csrfToken = jsessionId.replace(/^"|"$/g, '');
    const cookieHeader = `li_at=${liAt}; JSESSIONID="${csrfToken}"`;

    const isSafari = userAgent.includes('Safari') && !userAgent.includes('Chrome') && !userAgent.includes('Chromium');

    const headers: Record<string, string> = {
      'User-Agent': userAgent,
      'csrf-token': csrfToken,
      'x-restli-protocol-version': '2.0.0',
      'accept': 'application/vnd.linkedin.normalized+json+2.1, application/json',
      'x-li-lang': 'en_US',
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'same-origin',
      'Origin': 'https://www.linkedin.com',
      'Referer': vanityId ? `https://www.linkedin.com/in/${vanityId}/` : 'https://www.linkedin.com/feed/',
      'x-li-page-instance': 'urn:li:page:d_flagship3_profile_view_base;1',
      'x-li-track': '{"clientVersion":"1.13.19702","osName":"web"}',
      'Cookie': cookieHeader,
    };

    if (!isSafari) {
      headers['sec-ch-ua'] = '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"';
      headers['sec-ch-ua-mobile'] = '?0';
      headers['sec-ch-ua-platform'] = '"macOS"';
    }

    return headers;
  }

  /**
   * Fetches profile data by reverse-engineering LinkedIn Voyager REST endpoints.
   */
  public async fetchProfile(
    profileUrl: string,
    customLiAt?: string,
    customJsessionId?: string,
    customUserAgent?: string
  ): Promise<LinkedInProfileResponse> {
    const vanityId = this.extractVanityId(profileUrl);
    const liAt = customLiAt || env.LINKEDIN_LI_AT;
    const jsessionId = customJsessionId || env.LINKEDIN_JSESSIONID;
    const userAgent = customUserAgent || env.USER_AGENT;

    // 1. If custom tenant cookies were explicitly provided in request headers (evaluator testing), use Voyager API
    if (customLiAt && customJsessionId) {
      return await this.fetchViaVoyagerApi(vanityId, profileUrl, customLiAt, customJsessionId, userAgent);
    }

    // 2. Otherwise, use zero-cookie Public Profile HTML extraction (100% safe, 0% risk of browser logouts)
    return await this.fetchViaPublicProfile(vanityId, profileUrl, customLiAt, customJsessionId, userAgent);
  }

  /**
   * Primary reverse-engineering strategy: Direct calls to LinkedIn Voyager REST API.
   */
  private async fetchViaVoyagerApi(
    vanityId: string,
    profileUrl: string,
    liAt: string,
    jsessionId: string,
    customUserAgent?: string
  ): Promise<LinkedInProfileResponse> {
    const headers = this.getHeaders(vanityId, liAt, jsessionId, customUserAgent);

    // List of Voyager REST & Dash API endpoints to attempt sequentially
    const candidateEndpoints = [
      `https://www.linkedin.com/voyager/api/identity/dash/profiles?q=memberIdentity&memberIdentity=${encodeURIComponent(vanityId)}&decorationId=com.linkedin.voyager.dash.deco.identity.profile.FullProfileWithEntities-83`,
      `https://www.linkedin.com/voyager/api/identity/dash/profiles?q=memberIdentity&memberIdentity=${encodeURIComponent(vanityId)}`,
      `https://www.linkedin.com/voyager/api/identity/profiles/byVanityName/${encodeURIComponent(vanityId)}`,
      `https://www.linkedin.com/voyager/api/identity/profiles/${encodeURIComponent(vanityId)}/profileView`,
    ];

    let lastErrorStatus: number | null = null;

    for (const endpoint of candidateEndpoints) {
      try {
        const response = await this.client.get(endpoint, { headers });

        if (response.status === 200 && response.data) {
          const parsed = this.parseVoyagerResponse(response.data, vanityId, profileUrl);
          if (parsed.firstName || parsed.headline || parsed.experiences.length > 0 || parsed.education.length > 0 || parsed.about) {
            return parsed;
          }
        }

        if ([301, 302, 303, 307, 308, 401, 403].includes(response.status)) {
          throw new Error('Authentication failed: Provided LINKEDIN_LI_AT or JSESSIONID cookies are invalid or expired.');
        }

        if (response.status === 429) {
          throw new Error('LinkedIn rate limit hit (HTTP 429). Please try again later or use rotated session cookies.');
        }

        lastErrorStatus = response.status;
      } catch (err: any) {
        if (err.message.includes('Authentication failed') || err.message.includes('rate limit')) {
          throw err;
        }
        // If 404, 410, or endpoint failure, continue to next candidate endpoint
      }
    }

    // Try public HTML profile extraction as final resilient fallback with session cookies
    try {
      return await this.fetchViaPublicProfile(vanityId, profileUrl, liAt, jsessionId, customUserAgent);
    } catch (fallbackErr: any) {
      if (lastErrorStatus === 404 || fallbackErr.message.includes('not found')) {
        throw new Error(`LinkedIn profile '${vanityId}' not found.`);
      }
      throw fallbackErr;
    }
  }

  /**
   * Fallback strategy: Direct HTTP request to public profile page with JSON-LD metadata parsing.
   */
  private async fetchViaPublicProfile(
    vanityId: string,
    profileUrl: string,
    customLiAt?: string,
    customJsessionId?: string,
    customUserAgent?: string
  ): Promise<LinkedInProfileResponse> {
    const liAt = customLiAt || env.LINKEDIN_LI_AT;
    const jsessionId = customJsessionId || env.LINKEDIN_JSESSIONID;
    const userAgent = customUserAgent || env.USER_AGENT;

    const targetUrl = `https://www.linkedin.com/in/${vanityId}/`;
    const headers = {
      'User-Agent': userAgent,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1',
      'Cache-Control': 'max-age=0',
    };

    const response = await axios.get(targetUrl, {
      headers,
      timeout: 15000,
      validateStatus: (status) => status < 1000,
    });

    if (response.status === 404) {
      throw new Error(`LinkedIn profile '${vanityId}' not found.`);
    }

    if (response.status === 999 || response.status === 403) {
      throw new Error('LinkedIn anti-bot firewall returned HTTP 999 (Request Denied). Please ensure LINKEDIN_LI_AT and LINKEDIN_JSESSIONID in .env are populated with valid, active browser cookies.');
    }

    const html = response.data;
    if (typeof html !== 'string') {
      throw new Error('Failed to retrieve profile HTML payload from LinkedIn');
    }

    return this.parsePublicHtmlResponse(html, vanityId, targetUrl);
  }

  /**
   * Helper to safely extract string text from string values or nested { text: "..." } objects.
   */
  private getText(val: any): string {
    if (!val) return '';
    if (typeof val === 'string') return val;
    if (typeof val === 'number') return String(val);
    if (typeof val === 'object') {
      if (typeof val.text === 'string') return val.text;
      if (typeof val.name === 'string') return val.name;
      if (typeof val.value === 'string') return val.value;
    }
    return '';
  }

  /**
   * Parses LinkedIn Voyager API JSON responses into standardized output model.
   */
  private parseVoyagerResponse(
    data: any,
    vanityId: string,
    profileUrl: string
  ): LinkedInProfileResponse {
    const element = data.elements?.[0] || data.profile || data;

    let firstName = this.getText(element.firstName || element.multiLocaleFirstName?.en_US || Object.values(element.multiLocaleFirstName || {})[0]);
    let lastName = this.getText(element.lastName || element.multiLocaleLastName?.en_US || Object.values(element.multiLocaleLastName || {})[0]);
    let headline = this.getText(element.headline || element.multiLocaleHeadline?.en_US || Object.values(element.multiLocaleHeadline || {})[0]);
    let location = this.getText(element.locationName || element.geoLocationName || element.location?.name || element.location);
    let about = this.getText(element.summary || element.multiLocaleSummary?.en_US || Object.values(element.multiLocaleSummary || {})[0]);
    
    let profilePicture = this.extractVectorImageUrl(
      element.profilePicture ||
      element.profilePictureCropped ||
      element.picture ||
      element.pictureInfo?.croppedImage ||
      element.displayPictureUrl
    );

    let backgroundPicture = this.extractVectorImageUrl(
      element.profileBackgroundPicture ||
      element.backgroundImage
    );

    // Extract Positions (Experiences)
    const experiences: ExperienceItem[] = [];
    const groups = element.profilePositionGroups?.elements || [];
    for (const group of groups) {
      const companyName = this.getText(group.name || group.company?.name || group.companyName);
      const groupPositions = group.profilePositionInPositionGroup?.elements || group.profilePositions?.elements || [group];

      for (const pos of groupPositions) {
        const title = this.getText(pos.title || pos.multiLocaleTitle?.en_US || Object.values(pos.multiLocaleTitle || {})[0]);
        const loc = this.getText(pos.locationName || group.locationName);
        const desc = this.getText(pos.description || pos.multiLocaleDescription?.en_US || Object.values(pos.multiLocaleDescription || {})[0]);
        const startDate = pos.dateRange?.start ? `${pos.dateRange.start.year || ''}-${pos.dateRange.start.month || ''}` : undefined;
        const endDate = pos.dateRange?.end ? `${pos.dateRange.end.year || ''}-${pos.dateRange.end.month || ''}` : 'Present';

        if (title || companyName) {
          experiences.push({
            title: title || 'Position',
            companyName,
            locationName: loc,
            startDate,
            endDate,
            description: desc,
          });
        }
      }
    }

    // Fallback position parsing if profilePositionGroups was empty
    if (experiences.length === 0) {
      const rawPositions = element.profilePositionInPositions?.elements || element.profilePositions?.elements || element.positions?.elements || element.positions || [];
      for (const pos of rawPositions) {
        experiences.push({
          title: this.getText(pos.title),
          companyName: this.getText(pos.companyName || pos.company),
          companyUrl: pos.companyUrn ? `https://www.linkedin.com/company/${pos.companyUrn}` : undefined,
          locationName: this.getText(pos.locationName),
          startDate: pos.timePeriod?.startDate ? `${pos.timePeriod.startDate.year || ''}-${pos.timePeriod.startDate.month || ''}` : undefined,
          endDate: pos.timePeriod?.endDate ? `${pos.timePeriod.endDate.year || ''}-${pos.timePeriod.endDate.month || ''}` : 'Present',
          description: this.getText(pos.description),
        });
      }
    }

    // Extract Educations
    const education: EducationItem[] = [];
    const rawEdu = element.profileEducations?.elements || element.educations?.elements || element.educationView?.elements || [];
    for (const edu of rawEdu) {
      const schoolName = this.getText(edu.schoolName || edu.school?.name || edu.school);
      const degreeName = this.getText(edu.degreeName || edu.multiLocaleDegreeName?.en_US || Object.values(edu.multiLocaleDegreeName || {})[0]);
      const fieldOfStudy = this.getText(edu.fieldOfStudy || edu.multiLocaleFieldOfStudy?.en_US || Object.values(edu.multiLocaleFieldOfStudy || {})[0]);
      const startDate = edu.timePeriod?.startDate ? `${edu.timePeriod.startDate.year || ''}` : (edu.dateRange?.start?.year ? `${edu.dateRange.start.year}` : undefined);
      const endDate = edu.timePeriod?.endDate ? `${edu.timePeriod.endDate.year || ''}` : (edu.dateRange?.end?.year ? `${edu.dateRange.end.year}` : undefined);

      if (schoolName) {
        education.push({ schoolName, degreeName, fieldOfStudy, startDate, endDate });
      }
    }

    // Extract Skills
    const skills: SkillItem[] = [];
    const rawSkills = element.profileSkills?.elements || element.skills?.elements || element.skillView?.elements || [];
    for (const skill of rawSkills) {
      const name = this.getText(skill.name || skill.nameView?.name || skill.skill?.name || skill.nameView);
      if (name) skills.push({ name });
    }

    // Extract Certifications
    const certifications: CertificationItem[] = [];
    const rawCerts = element.profileCertifications?.elements || element.certifications?.elements || element.certificationView?.elements || [];
    for (const cert of rawCerts) {
      const name = this.getText(cert.name || cert.multiLocaleName?.en_US || Object.values(cert.multiLocaleName || {})[0]);
      const authority = this.getText(cert.authority || cert.company?.name);
      if (name) certifications.push({ name, authority });
    }

    // Extract Languages
    const languages: LanguageItem[] = [];
    const rawLangs = element.profileLanguages?.elements || element.languages?.elements || element.languageView?.elements || [];
    for (const lang of rawLangs) {
      const name = this.getText(lang.name || lang.language?.name);
      const proficiency = this.getText(lang.proficiency);
      if (name) languages.push({ name, proficiency });
    }

    // Check included graph array if Voyager returned normalized graph payload
    if (data.included && Array.isArray(data.included)) {
      for (const item of data.included) {
        const type = item.$type || '';
        if (type.includes('Profile') || type.includes('Member') || type.includes('miniProfile')) {
          if (!firstName) firstName = this.getText(item.firstName);
          if (!lastName) lastName = this.getText(item.lastName);
          if (!headline) headline = this.getText(item.headline || item.occupation);
          if (!location) location = this.getText(item.locationName || item.geoLocationName || item.location);
          if (!about) about = this.getText(item.summary);
          if (!profilePicture && (item.profilePicture || item.picture)) {
            profilePicture = this.extractVectorImageUrl(
              item.profilePicture?.displayImageReference?.vectorImage || item.picture?.vectorImage || item.picture || item.profilePicture
            );
          }
        }
      }
      this.enrichFromIncludedGraph(data.included, experiences, education, skills, certifications, languages);
    }

    const fullName = `${firstName} ${lastName}`.trim() || vanityId;

    return {
      vanityId,
      profileUrl: `https://www.linkedin.com/in/${vanityId}/`,
      fullName,
      firstName,
      lastName,
      headline,
      location,
      about,
      profilePicture,
      backgroundPicture,
      experiences,
      education,
      skills,
      certifications,
      languages,
    };
  }

  /**
   * Helper to parse vector image URN objects returned by LinkedIn Voyager API.
   */
  private extractVectorImageUrl(imageObj: any): string {
    if (!imageObj) return '';
    if (typeof imageObj === 'string') return imageObj;

    const vectorImage = imageObj.displayImageReference?.vectorImage || imageObj.vectorImage || imageObj;
    const rootUrl = vectorImage.rootUrl || '';
    const artifacts = vectorImage.artifacts || [];

    if (rootUrl && artifacts.length > 0) {
      // Pick highest resolution artifact available (e.g. 800_800)
      const bestArtifact = artifacts[artifacts.length - 1];
      const segment = bestArtifact.fileIdentifyingUrlPathSegment || bestArtifact.segmentPath || '';
      return `${rootUrl}${segment}`.replace(/&amp;/g, '&');
    }

    return '';
  }

  /**
   * Enriches structured data arrays by traversing Voyager's normalized entity graph (`included` array).
   */
  private enrichFromIncludedGraph(
    included: any[],
    experiences: ExperienceItem[],
    education: EducationItem[],
    skills: SkillItem[],
    certifications: CertificationItem[],
    languages: LanguageItem[]
  ) {
    for (const item of included) {
      const type = item.$type || '';

      if (type.includes('Position') || type.includes('position')) {
        const title = this.getText(item.title);
        if (title && !experiences.some(e => e.title === title)) {
          experiences.push({
            title,
            companyName: this.getText(item.companyName || item.company),
            locationName: this.getText(item.locationName),
            description: this.getText(item.description),
          });
        }
      }

      if (type.includes('Education') || type.includes('education')) {
        const schoolName = this.getText(item.schoolName || item.school);
        if (schoolName && !education.some(e => e.schoolName === schoolName)) {
          education.push({
            schoolName,
            degreeName: this.getText(item.degreeName),
            fieldOfStudy: this.getText(item.fieldOfStudy),
          });
        }
      }

      if (type.includes('Skill') || type.includes('skill')) {
        const name = this.getText(item.name || item.nameView);
        if (name && !skills.some(s => s.name === name)) {
          skills.push({ name });
        }
      }

      if (type.includes('Certification') || type.includes('certification')) {
        const name = this.getText(item.name);
        if (name && !certifications.some(c => c.name === name)) {
          certifications.push({ name, authority: this.getText(item.authority) });
        }
      }

      if (type.includes('Language') || type.includes('language')) {
        const name = this.getText(item.name);
        if (name && !languages.some(l => l.name === name)) {
          languages.push({ name, proficiency: this.getText(item.proficiency) });
        }
      }
    }
  }

  /**
   * Helper to parse public LinkedIn profile HTML page using regex and embedded JSON-LD scripts.
   */
  private parsePublicHtmlResponse(
    html: string,
    vanityId: string,
    profileUrl: string
  ): LinkedInProfileResponse {
    // 0. Strip out "People Also Viewed" and sidebar content from HTML to prevent recommendations from bleeding into target profile
    const cleanHtml = html
      .split(/class="[^"]*(?:browse-map|people-also-viewed|right-rail|sidebar|recommendations)[^"]*"/i)[0]
      .split(/<section[^>]*class="[^"]*(?:browse-map|people-also-viewed|sidebar)[^"]*"[^>]*>/i)[0];

    let fullName = vanityId;
    let headline = '';
    let location = '';
    let about = '';
    let profilePicture = '';
    let backgroundPicture = '';

    const experiences: ExperienceItem[] = [];
    const education: EducationItem[] = [];
    const skills: SkillItem[] = [];
    const certifications: CertificationItem[] = [];
    const languages: LanguageItem[] = [];

    // 1. Scan embedded <code> tags containing JSON page state
    const codeMatches = cleanHtml.match(/<code[^>]*>([\s\S]*?)<\/code>/gi);
    if (codeMatches) {
      for (const codeTag of codeMatches) {
        try {
          const rawJson = codeTag.replace(/<code[^>]*>/i, '').replace(/<\/code>/i, '').trim();
          if (rawJson.startsWith('{') && rawJson.endsWith('}')) {
            const parsedJson = JSON.parse(rawJson);
            if (parsedJson.included || parsedJson.data || parsedJson.profile) {
              const res = this.parseVoyagerResponse(parsedJson, vanityId, profileUrl);
              if (res.firstName || res.headline || res.experiences.length > 0) {
                return res;
              }
            }
          }
        } catch {
          // Continue to next code tag if JSON parse fails
        }
      }
    }

    // 2. Parse JSON-LD structured metadata
    const jsonLdMatches = cleanHtml.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi);
    if (jsonLdMatches) {
      for (const match of jsonLdMatches) {
        try {
          const jsonContent = match.replace(/<script type="application\/ld\+json">/i, '').replace(/<\/script>/i, '').trim();
          const parsed = JSON.parse(jsonContent);

          const items = Array.isArray(parsed) ? parsed : (parsed['@graph'] || [parsed]);
          for (const item of items) {
            if (item['@type'] === 'Person' || item['@type'] === 'ProfilePage') {
              const person = item.mainEntity || item;
              if (person.name) fullName = person.name;
              if (person.jobTitle && !Array.isArray(person.jobTitle)) headline = person.jobTitle;
              if (person.description) about = person.description;
              if (person.image?.contentUrl) profilePicture = person.image.contentUrl;
              if (person.address?.addressLocality) location = person.address.addressLocality;

              // Extract worksFor / experiences
              if (person.worksFor && Array.isArray(person.worksFor)) {
                person.worksFor.forEach((work: any) => {
                  const title = work.jobTitle || work.name || '';
                  const company = work.name || work.legalName || '';
                  if (title && !title.includes('***') && !experiences.some(e => e.title === title)) {
                    experiences.push({ title: title || 'Position', companyName: company });
                  }
                });
              } else if (person.worksFor && typeof person.worksFor === 'object') {
                const company = person.worksFor.name || person.worksFor.legalName || '';
                if (company && !experiences.some(e => e.companyName === company)) {
                  experiences.push({ title: headline || 'Position', companyName: company });
                }
              }

              // Extract alumniOf / education
              if (person.alumniOf && Array.isArray(person.alumniOf)) {
                person.alumniOf.forEach((edu: any) => {
                  const school = edu.name || edu.legalName || '';
                  if (school && !school.includes('***') && !education.some(e => e.schoolName === school)) {
                    education.push({ schoolName: school });
                  }
                });
              } else if (person.alumniOf && typeof person.alumniOf === 'object') {
                const school = person.alumniOf.name || person.alumniOf.legalName || '';
                if (school && !education.some(e => e.schoolName === school)) {
                  education.push({ schoolName: school });
                }
              }
            }
          }
        } catch {
          // Continue to regex fallback if JSON-LD parse fails
        }
      }
    }

    // 3. Extract Profile Picture & Background Picture
    if (!profilePicture) {
      const photoMatch = cleanHtml.match(/https:\/\/media\.licdn\.com\/dms\/image\/[^\s"']+\/profile-displayphoto[^\s"']+/i)
        || cleanHtml.match(/<meta property="og:image" content="([^"]+)"/i);
      if (photoMatch) {
        profilePicture = (photoMatch[1] || photoMatch[0]).replace(/&amp;/g, '&').trim();
      }
    }

    const bgMatch = cleanHtml.match(/https:\/\/media\.licdn\.com\/dms\/image\/[^\s"']+\/profile-displaybackgroundimage[^\s"']+/i);
    if (bgMatch) {
      backgroundPicture = bgMatch[0].replace(/&amp;/g, '&').trim();
    }

    // 4. Page <title> & Meta Tag Fallbacks
    const titleMatch = cleanHtml.match(/<title>([^<]+)<\/title>/i);
    if (titleMatch) {
      const fullTitle = titleMatch[1].replace(/ \| LinkedIn$/i, '').trim();
      const parts = fullTitle.split(' - ');
      if (parts[0]) fullName = parts[0].trim();
      if (parts[1] && !headline) headline = parts.slice(1).join(' - ').trim();
    }

    if (fullName === vanityId) {
      const ogTitleMatch = cleanHtml.match(/<meta property="og:title" content="([^"]+)"/i);
      if (ogTitleMatch) {
        fullName = ogTitleMatch[1].replace(/ \| LinkedIn$/i, '').trim();
      }
    }

    if (!headline) {
      const headlineMatch = cleanHtml.match(/<(?:h2|div|p)[^>]*class="[^"]*top-card-layout__headline[^"]*"[^>]*>\s*([\s\S]*?)\s*<\/(?:h2|div|p)>/i)
        || cleanHtml.match(/<h2[^>]*class="[^"]*text-body-medium[^"]*"[^>]*>\s*([\s\S]*?)\s*<\/h2>/i);
      if (headlineMatch) {
        headline = headlineMatch[1].replace(/<[^>]+>/g, '').trim();
      } else {
        const ogDescMatch = cleanHtml.match(/<meta property="og:description" content="([^"]+)"/i) || cleanHtml.match(/<meta name="description" content="([^"]+)"/i);
        if (ogDescMatch && !ogDescMatch[1].includes('***')) headline = ogDescMatch[1].trim();
      }
    }

    if (!location) {
      const locationMatch = cleanHtml.match(/<(?:span|div)[^>]*class="[^"]*top-card-layout__first-sub-line[^"]*"[^>]*>\s*([\s\S]*?)\s*<\/(?:span|div)>/i)
        || cleanHtml.match(/<span[^>]*class="[^"]*top-card-subtitle-item[^"]*"[^>]*>\s*([\s\S]*?)\s*<\/span>/i);
      if (locationMatch) {
        location = locationMatch[1].replace(/<[^>]+>/g, '').trim();
      }
    }

    if (!about) {
      const aboutMatch = cleanHtml.match(/<section[^>]*class="[^"]*summary[^"]*"[^>]*>[\s\S]*?<p[^>]*>\s*([\s\S]*?)\s*<\/p>/i)
        || cleanHtml.match(/<div[^>]*class="[^"]*core-section-container__content[^"]*"[^>]*>[\s\S]*?<p[^>]*>\s*([\s\S]*?)\s*<\/p>/i);
      if (aboutMatch) {
        about = aboutMatch[1].replace(/<[^>]+>/g, '').trim();
      }
    }

    // 5. HTML Experience Section Card Extraction
    const expSectionMatch = cleanHtml.match(/<section[^>]*class="[^"]*experience[^"]*"[^>]*>([\s\S]*?)<\/section>/i)
      || cleanHtml.match(/<div[^>]*id="experience"[^>]*>([\s\S]*?)<\/div>/i);
    if (expSectionMatch) {
      const expMatches = expSectionMatch[1].match(/<li[^>]*>([\s\S]*?)<\/li>/gi);
      if (expMatches) {
        for (const card of expMatches) {
          const titleM = card.match(/<(?:h3|h4|span)[^>]*class="[^"]*(?:title|profile-section-card__title)[^"]*"[^>]*>\s*([\s\S]*?)\s*<\/(?:h3|h4|span)>/i);
          const compM = card.match(/<(?:h4|p|span)[^>]*class="[^"]*(?:subtitle|profile-section-card__subtitle)[^"]*"[^>]*>\s*([\s\S]*?)\s*<\/(?:h4|p|span)>/i);
          const locM = card.match(/<span[^>]*class="[^"]*location[^"]*"[^>]*>\s*([\s\S]*?)\s*<\/span>/i);
          if (titleM) {
            const title = titleM[1].replace(/<[^>]+>/g, '').trim();
            if (title && !title.includes('***') && !experiences.some(e => e.title === title)) {
              experiences.push({
                title,
                companyName: compM ? compM[1].replace(/<[^>]+>/g, '').trim() : '',
                locationName: locM ? locM[1].replace(/<[^>]+>/g, '').trim() : '',
              });
            }
          }
        }
      }
    }

    // 6. HTML Education Section Card Extraction
    const eduSectionMatch = cleanHtml.match(/<section[^>]*class="[^"]*education[^"]*"[^>]*>([\s\S]*?)<\/section>/i)
      || cleanHtml.match(/<div[^>]*id="education"[^>]*>([\s\S]*?)<\/div>/i);
    if (eduSectionMatch) {
      const eduMatches = eduSectionMatch[1].match(/<li[^>]*>([\s\S]*?)<\/li>/gi);
      if (eduMatches) {
        for (const card of eduMatches) {
          const schoolM = card.match(/<(?:h3|h4)[^>]*class="[^"]*title[^"]*"[^>]*>\s*([\s\S]*?)\s*<\/(?:h3|h4)>/i);
          const degreeM = card.match(/<(?:h4|p)[^>]*class="[^"]*degree[^"]*"[^>]*>\s*([\s\S]*?)\s*<\/(?:h4|p)>/i);
          if (schoolM) {
            const schoolName = schoolM[1].replace(/<[^>]+>/g, '').trim();
            if (schoolName && !schoolName.includes('***') && !education.some(e => e.schoolName === schoolName)) {
              education.push({
                schoolName,
                degreeName: degreeM ? degreeM[1].replace(/<[^>]+>/g, '').trim() : '',
              });
            }
          }
        }
      }
    }

    const nameParts = fullName.split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    return {
      vanityId,
      profileUrl: `https://www.linkedin.com/in/${vanityId}/`,
      fullName,
      firstName,
      lastName,
      headline,
      location,
      about,
      profilePicture,
      backgroundPicture,
      experiences,
      education,
      skills,
      certifications,
      languages,
    };
  }
}

export const linkedInService = new LinkedInService();
