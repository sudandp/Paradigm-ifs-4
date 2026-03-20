// The logo is a local image path to prevent CORS issues during PDF generation and to use the new logo.
// Use a local asset for the default logo instead of an external URL.  This points to
// the bundled image file located at the project root.  Keeping the logo local
// prevents external network requests during PDF generation and avoids CORS issues.
export const originalDefaultLogoBase64 = '/Paradigm-Logo-3-1024x157.png';

// Local path for the logo, used specifically for client-side PDF generation
export const pdfLogoLocalPath = '/Paradigm-Logo-3-1024x157.png';