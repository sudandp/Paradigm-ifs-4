const fs = require('fs');

function checkNames() {
  const html = fs.readFileSync('scratch/last_email_sent.html', 'utf8');
  const names = ['Abhishek T', 'Sachin Kote', 'Pravin Prasad', 'Kavya Hegde', 'Arjun Kumar Arjun'];
  names.forEach(name => {
    console.log(`Contains "${name}": ${html.includes(name)}`);
  });
  
  // Print a snippet of the table rows
  const tbodyIdx = html.indexOf('<tbody>');
  if (tbodyIdx !== -1) {
    console.log('\ntbody snippet:');
    console.log(html.substring(tbodyIdx, tbodyIdx + 600));
  } else {
    console.log('\nNo <tbody> found');
  }
}

checkNames();
