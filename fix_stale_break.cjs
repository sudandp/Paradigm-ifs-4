const fs = require('fs');
const file = 'pages/profile/ProfilePage.tsx';
let content = fs.readFileSync(file, 'utf8');

// Find the desktop stale break End Break Now button and change navigate to setStaleBreakConfirm
// The navigate('/attendance/break-out') in the desktop banner (with amber-500 styling) needs replacing
const oldBtn = `onClick={() => navigate('/attendance/break-out')}
                                                                      variant="primary"
                                                                      className="!h-7 !text-[10px] !px-2.5 !bg-amber-500 hover:!bg-amber-600"`;

const newBtn = `onClick={() => setStaleBreakConfirm(true)}
                                                                      variant="primary"
                                                                      className="!h-7 !text-[10px] !px-2.5 !bg-amber-500 hover:!bg-amber-600"`;

if (content.includes(oldBtn)) {
  content = content.replace(oldBtn, newBtn);
  fs.writeFileSync(file, content, 'utf8');
  console.log('SUCCESS: Desktop End Break Now button patched to use setStaleBreakConfirm(true)');
} else {
  console.log('NOT FOUND - checking what exists around break-out in the file...');
  const idx = content.indexOf("navigate('/attendance/break-out')");
  if (idx !== -1) {
    console.log('Context around navigate break-out:');
    console.log(JSON.stringify(content.substring(idx - 200, idx + 200)));
  }
}
