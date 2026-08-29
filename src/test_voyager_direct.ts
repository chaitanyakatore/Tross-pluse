import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

async function testVoyagerDirect(vanityId: string) {
  const userAgent = process.env.USER_AGENT || 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15';
  const liAt = process.env.LINKEDIN_LI_AT || '';
  const jsessionId = process.env.LINKEDIN_JSESSIONID || '';
  const csrfToken = jsessionId.replace(/^"|"$/g, '');

  const headers: Record<string, string> = {
    'User-Agent': userAgent,
    'csrf-token': csrfToken,
    'x-restli-protocol-version': '2.0.0',
    'accept': 'application/vnd.linkedin.normalized+json+2.1, application/json',
    'x-li-lang': 'en_US',
    'Cookie': `li_at=${liAt}; JSESSIONID="${csrfToken}"`,
  };

  const endpoints = [
    `https://www.linkedin.com/voyager/api/identity/dash/profiles?q=memberIdentity&memberIdentity=${vanityId}&decorationId=com.linkedin.voyager.dash.deco.identity.profile.FullProfileWithEntities-83`,
    `https://www.linkedin.com/voyager/api/identity/profiles/${vanityId}/profileView`,
    `https://www.linkedin.com/voyager/api/identity/profiles/byVanityName/${vanityId}`,
    `https://www.linkedin.com/voyager/api/graphql?variables=(vanityName:${vanityId})&queryId=voyagerIdentityDashProfiles.a8e8b2110c7333d014eb3a1f9a117b4c`,
  ];

  console.log(`\n=================== Testing Voyager Direct for: ${vanityId} ===================`);
  for (let i = 0; i < endpoints.length; i++) {
    const ep = endpoints[i];
    try {
      const res = await axios.get(ep, { headers, timeout: 10000, validateStatus: () => true });
      console.log(`Endpoint #${i + 1} (${res.status}): ${ep.substring(0, 80)}...`);
      if (res.status === 200 && res.data) {
        const keys = Object.keys(res.data);
        console.log(`  Success! Keys:`, keys);
        if (res.data.included) {
          console.log(`  Included entities count:`, res.data.included.length);
          const sampleTypes = res.data.included.map((item: any) => item.$type).filter(Boolean).slice(0, 10);
          console.log(`  Sample entity types:`, sampleTypes);
        }
      }
    } catch (e: any) {
      console.log(`Endpoint #${i + 1} failed: ${e.message}`);
    }
  }
}

async function main() {
  await testVoyagerDirect('satyanadella');
  await testVoyagerDirect('williamhgates');
  await testVoyagerDirect('chaitanya-katore-87964921b');
}

main();
