
const { getProxyUrl } = require('./utils/fileUrl');

// Mocking processUrlsForDisplay logic from api.ts
const AVATAR_BUCKET = 'avatars';
const ONBOARDING_DOCS_BUCKET = 'compliance-documents';

const processUrlsForDisplay = (obj) => {
  if (obj === null) return obj;
  if (typeof obj === 'string') return getProxyUrl(obj);
  if (Array.isArray(obj)) return obj.map(processUrlsForDisplay);
  if (typeof obj !== 'object') return obj;

  const newObj = { ...obj };
  if (typeof newObj.name === 'string' && typeof newObj.path === 'string') {
    // Mocking supabase response
    const publicUrl = `https://fmyafuhxlorbafbacywa.supabase.co/storage/v1/object/public/${newObj.path}`;
    const maskedUrl = getProxyUrl(publicUrl);
    newObj.preview = maskedUrl;
    newObj.url = maskedUrl;
  }

  for (const key in newObj) {
    newObj[key] = processUrlsForDisplay(newObj[key]);
  }
  return newObj;
};

// Test cases
const testUser = {
  id: 'user-1',
  name: 'Ankit',
  photo_url: 'https://fmyafuhxlorbafbacywa.supabase.co/storage/v1/object/public/avatars/user-1/profile.jpg'
};

const testOnboarding = {
  personal: {
    photo: {
      name: 'me.jpg',
      path: 'avatars/uid/me.jpg'
    }
  }
};

console.log('Testing User Photo URL Proxying:');
const processedUser = processUrlsForDisplay(testUser);
console.log(JSON.stringify(processedUser, null, 2));

console.log('\nTesting Onboarding Photo Object Proxying:');
const processedOnboarding = processUrlsForDisplay(testOnboarding);
console.log(JSON.stringify(processedOnboarding, null, 2));

if (processedUser.photo_url.startsWith('/api/view-file/')) {
  console.log('\nSUCCESS: User photo URL was proxied.');
} else {
  console.error('\nFAILURE: User photo URL was NOT proxied.');
}

if (processedOnboarding.personal.photo.preview.startsWith('/api/view-file/')) {
  console.log('SUCCESS: Onboarding photo object was proxied.');
} else {
  console.error('FAILURE: Onboarding photo object was NOT proxied.');
}
