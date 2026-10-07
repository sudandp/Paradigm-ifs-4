const fs = require('fs');
const html = fs.readFileSync('scratch/db_template_dump.html', 'utf8');
const report_type = 'crm_bd_daily';
const hasGreetingPlaceholder = html.includes('{greetingMessage}') || html.includes('{customGreeting}') || html.includes('{greeting_message}') || html.includes('{custom_greeting}') || html.includes('{summary}');
console.log('hasGreetingPlaceholder:', hasGreetingPlaceholder);
console.log('report_type.includes("bd_daily"):', report_type.includes('bd_daily'));
console.log('Would add greetingBlock?', !hasGreetingPlaceholder && !report_type.includes('bd_daily'));
