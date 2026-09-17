const fs = require('fs');
const path = require('path');

const pBase = fs.readFileSync(path.join(__dirname, '../public/paradigm-logo.png')).toString('base64');
const swBase = fs.readFileSync(path.join(__dirname, '../public/South-Wall-Logo.png')).toString('base64');

const content = `// Centralized report logos & company branding for Excel, PDF, and Web reports

export const PARADIGM_LOGO_BASE64 = '${pBase}';
export const PARADIGM_LOGO_EXT: 'png' | 'jpeg' = 'png';

export const SOUTHWALL_LOGO_BASE64 = '${swBase}';
export const SOUTHWALL_LOGO_EXT: 'png' | 'jpeg' = 'jpeg';

export interface CompanyBranding {
  companyName: string;
  headerTitle: string;
  primaryColor: string; // Excel ARGB
  accentColor: string;  // Excel ARGB
  lightBgColor: string; // Excel ARGB
  cssHexColor: string;
  logoBase64: string;
  logoExt: 'png' | 'jpeg';
  webLogoPath: string;
}

export const isSecurityEmployee = (emp?: { designation?: string; role?: string; company?: string; department?: string } | null): boolean => {
  if (!emp) return false;
  const des = (emp.designation || '').toLowerCase();
  const role = (emp.role || '').toLowerCase();
  const comp = (emp.company || '').toLowerCase();

  if (comp.includes('south wall') || comp.includes('southwall') || comp.includes('south-wall') || comp.includes('swllp') || comp.startsWith('sw-') || comp === 'sw') {
    return true;
  }

  const securityKeywords = ['security', 'guard', 'aso', 'gunman', 'bouncer', 'patrol', 'warden', 'marshal', 'cctv'];
  for (const kw of securityKeywords) {
    if (des.includes(kw) || role.includes(kw)) {
      return true;
    }
  }

  if (/\\bso\\b/i.test(des) || /\\bso\\b/i.test(role)) {
    return true;
  }

  return false;
};

export const getCompanyBranding = (isSecurity: boolean): CompanyBranding => {
  if (isSecurity) {
    return {
      companyName: 'SOUTHWALL SECURITY LLP',
      headerTitle: 'SOUTHWALL SECURITY LLP',
      primaryColor: 'FF0F2942', // Deep Southwall Navy
      accentColor: 'FF1E40AF',
      lightBgColor: 'FFEFF6FF',
      cssHexColor: '#0F2942',
      logoBase64: SOUTHWALL_LOGO_BASE64,
      logoExt: SOUTHWALL_LOGO_EXT,
      webLogoPath: '/South-Wall-Logo.png'
    };
  }
  return {
    companyName: 'PARADIGM SERVICES™',
    headerTitle: 'PARADIGM SERVICES™',
    primaryColor: 'FF006B3F', // Paradigm Forest Green
    accentColor: 'FF15803D',
    lightBgColor: 'FFF0FDF4',
    cssHexColor: '#006B3F',
    logoBase64: PARADIGM_LOGO_BASE64,
    logoExt: PARADIGM_LOGO_EXT,
    webLogoPath: '/paradigm-logo.png'
  };
};
`;

fs.writeFileSync(path.join(__dirname, '../utils/reportLogos.ts'), content, 'utf8');
console.log('Successfully generated utils/reportLogos.ts, size:', content.length);
