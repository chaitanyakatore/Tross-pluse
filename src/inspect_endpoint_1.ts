import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

async function inspectEndpoint1(vanityId: string) {
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

  const url = `https://www.linkedin.com/voyager/api/identity/dash/profiles?q=memberIdentity&memberIdentity=${vanityId}&decorationId=com.linkedin.voyager.dash.deco.identity.profile.FullProfileWithEntities-83`;

  console.log(`\n=================== Inspecting Endpoint #1 for: ${vanityId} ===================`);
  try {
    const res = await axios.get(url, { headers });
    console.log('Full JSON response:', JSON.stringify(res.data, null, 2).substring(0, 3000));
  } catch (err: any) {
    console.error(`Error fetching Endpoint #1 for ${vanityId}:`, err.message);
  }
}

async function main() {
  await inspectEndpoint1('satyanadella');
  await inspectEndpoint1('chaitanya-katore-87964921b');
}

main();
