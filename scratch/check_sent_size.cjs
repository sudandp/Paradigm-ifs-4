const fs = require('fs');

function checkSize() {
  const stats = fs.statSync('scratch/last_email_sent.html');
  console.log(`Sent email HTML size: ${stats.size} bytes (${(stats.size / 1024).toFixed(2)} KB)`);
}

checkSize();
