import fs from 'fs';

const htmlPath = '/Users/chaitanyakatore/.gemini/antigravity/brain/378ff0a3-c257-4069-8918-687b4bf3a483/scratch/raw_response.html';
const html = fs.readFileSync(htmlPath, 'utf-8');

const match = html.match(/window\.__como_rehydration__\s*=\s*([\s\S]*?);<\/script>/);
if (match) {
  const content = match[1];
  console.log('Rehydration script content length:', content.length);
  
  // Extract all quoted JSON strings or key-value pairs
  const givenNameMatch = content.match(/"givenName":"([^"]+)"/);
  const familyNameMatch = content.match(/"familyName":"([^"]+)"/);
  console.log('Given Name:', givenNameMatch ? givenNameMatch[1] : 'NONE');
  console.log('Family Name:', familyNameMatch ? familyNameMatch[1] : 'NONE');
  
  // Search for headlines, summaries, positions, skills, degrees
  const headlines = content.match(/"headline":"([^"]+)"/g) || content.match(/"headline":\{"text":"([^"]+)"\}/g);
  console.log('Headlines found:', headlines);
  
  const summaries = content.match(/"summary":"([^"]+)"/g) || content.match(/"summary":\{"text":"([^"]+)"\}/g);
  console.log('Summaries found:', summaries);

  const titles = content.match(/"title":"([^"]+)"/g) || content.match(/"title":\{"text":"([^"]+)"\}/g);
  console.log('Titles found (sample 5):', titles ? titles.slice(0, 5) : []);

  const schoolNames = content.match(/"schoolName":"([^"]+)"/g) || content.match(/"schoolName":\{"text":"([^"]+)"\}/g);
  console.log('School names found (sample 5):', schoolNames ? schoolNames.slice(0, 5) : []);
} else {
  console.log('window.__como_rehydration__ not found!');
}
