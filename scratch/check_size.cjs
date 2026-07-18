const fs = require('fs');

function checkSize() {
  const stats = fs.statSync('scratch/generated_table.html');
  console.log(`Generated table size: ${stats.size} bytes (${(stats.size / 1024).toFixed(2)} KB)`);
}

checkSize();
