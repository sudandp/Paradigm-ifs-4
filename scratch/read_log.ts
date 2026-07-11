import * as fs from 'fs';

function readLog() {
  const files = ['server.log', 'server_log.txt'];
  for (const file of files) {
    if (fs.existsSync(file)) {
      console.log(`=== Reading ${file} ===`);
      const content = fs.readFileSync(file, 'utf8');
      console.log(content.slice(-2000)); // Print last 2000 characters
    }
  }
}

readLog();
