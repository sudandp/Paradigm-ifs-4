const fs = require('fs');

function analyzeHtml() {
  const html = fs.readFileSync('scratch/generated_table.html', 'utf8');
  
  // Find all rows in tbody
  const matches = html.match(/<td[^>]*style="[^"]*font-weight:\s*600;[^"]*"[^>]*>([^<]+)<\/td>/g) || [];
  console.log(`Found ${matches.length} employee rows in the table HTML:`);
  matches.forEach((m, i) => {
    const name = m.replace(/<[^>]+>/g, '').trim();
    console.log(`${i+1}. ${name}`);
  });
}

analyzeHtml();
