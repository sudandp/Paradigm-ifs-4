const fs = require('fs');

function inspectRows() {
  const html = fs.readFileSync('scratch/generated_table.html', 'utf8');
  
  // Find a snippet of a row
  const rowStart = html.indexOf('<tr class="even">');
  if (rowStart !== -1) {
    console.log(html.substring(rowStart, rowStart + 1000));
  } else {
    console.log('No <tr class="even"> found');
  }
}

inspectRows();
