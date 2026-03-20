import JSZip from 'jszip';
import { differenceInYears } from 'date-fns';

export interface AadhaarAddress {
    line1: string;
    city: string;
    state: string;
    pincode: string;
}

export interface AadhaarData {
    name: string;
    dob: string;
    gender: string;
    address: AadhaarAddress;
    aadhaarNumber: string;
    photo?: string;
    dataAsOn?: string;
    mobile?: string;
    email?: string;
    careOf?: string;
    enrollmentDate?: string;
}

export const formatNameToTitleCase = (value: string | undefined) => {
    if (!value) return '';
    return value.toLowerCase().replace(/\b(\w)/g, s => s.toUpperCase());
};

export const formatDobToISO = (dob: string): string => {
    if (!dob) return '';
    const cleaned = dob.replace(/[^-/0-9]/g, '').trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) return cleaned;
    
    const parts = cleaned.split(/[-/]/);
    if (parts.length === 3) {
        const [p1, p2, p3] = parts;
        const year = p3.length === 4 ? p3 : (p1.length === 4 ? p1 : '');
        const day = p3.length === 4 ? p1 : (p1.length === 4 ? p3 : '');
        const month = p2.padStart(2, '0');
        const d = day.padStart(2, '0');
        
        if (year) return `${year}-${month}-${d}`;
    }
    return cleaned;
};

export const formatGender = (gender: string): string => {
    const g = (gender || '').toUpperCase();
    if (g === 'M' || g === 'MALE') return 'Male';
    if (g === 'F' || g === 'FEMALE') return 'Female';
    return 'Other';
};

export const parseAadhaarQR = (qrText: string): AadhaarData | null => {
    try {
        if (qrText.includes('<?xml')) {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(qrText, 'text/xml');
            const root = xmlDoc.documentElement;

            const getVal = (tags: string[]) => {
                for (const tag of tags) {
                    const attr = root.getAttribute(tag);
                    if (attr) return attr.trim();
                    const el = xmlDoc.getElementsByTagName(tag)[0] || xmlDoc.querySelector(tag);
                    if (el && el.textContent) return el.textContent.trim();
                }
                return '';
            };
            
            const uid = getVal(['uid', 'u', 'uidUID', 'UID', 'AadhaarNumber']);
            const name = getVal(['name', 'n', 'Name']);
            const dob = getVal(['dob', 'd', 'dOB', 'DOB']);
            const gender = getVal(['gender', 'g']);
            const house = getVal(['house', 'h', 'building']);
            const street = getVal(['street', 's', 'loc']);
            const loc = getVal(['loc', 'lm', 'locality']);
            const vtc = getVal(['vtc', 'v', 'vtc']);
            const dist = getVal(['dist', 'd', 'district']);
            const state = getVal(['state', 's', 'st', 'state']);
            const pc = getVal(['pc', 'p', 'pincode']);
            const co = getVal(['co', 'careOf', 'careof']);
            const email = getVal(['email', 'e']);
            const mobile = getVal(['mobile', 'm']);
            const enrollmentDate = getVal(['enrollmentDate']); 

            const addressParts = [house, street, loc].filter(Boolean);
            const line1 = addressParts.join(', ');

            return {
                name,
                dob: formatDobToISO(dob),
                gender: formatGender(gender),
                address: {
                    line1,
                    city: vtc || dist,
                    state,
                    pincode: pc
                },
                aadhaarNumber: uid,
                careOf: co,
                email,
                mobile,
                enrollmentDate
            };
        }
        return null;
    } catch (err) {
        return null;
    }
};

export const decodeSecureQR = async (numericText: string): Promise<AadhaarData | null> => {
    try {
        const bigInt = BigInt(numericText);
        let hex = bigInt.toString(16);
        if (hex.length % 2 !== 0) hex = '0' + hex;
        const bytes = new Uint8Array(hex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));

        const stream = new ReadableStream({
            start(controller) {
                controller.enqueue(bytes);
                controller.close();
            }
        });

        const decompressedStream = stream.pipeThrough(new (window as any).DecompressionStream('gzip'));
        const reader = decompressedStream.getReader();
        const chunks: Uint8Array[] = [];
        
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) chunks.push(value as Uint8Array);
        }

        const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
        const data = new Uint8Array(totalLength);
        let offset = 0;
        for (const chunk of chunks) {
            data.set(chunk, offset);
            offset += chunk.length;
        }

        const textDecoder = new TextDecoder('iso-8859-1');
        const fields: string[] = [];
        let currentFieldBytes: number[] = [];
        
        for (let i = 0; i < data.length; i++) {
            if (data[i] === 255) {
                fields.push(textDecoder.decode(new Uint8Array(currentFieldBytes)));
                currentFieldBytes = [];
                if (fields.length > 30) break; 
            } else {
                currentFieldBytes.push(data[i]);
            }
        }

        if (fields.length < 5) return null;

        const name = fields[3] || '';
        const dobRaw = fields[4] || '';
        const genderRaw = fields[5] || '';
        const maskedMobile = fields[17] || '';
        const maskedEmail = fields[18] || '';

        const house = fields[9] || '';
        const layout = fields[14] || '';
        const locality = fields[10] || '';
        const landmark = fields[8] || '';
        const subLocality = fields[16] || '';
        const town = fields[12] || '';
        const city = fields[7] || '';
        const state = fields[13] || '';
        const pincode = fields[11] || '';
        
        const addrParts = [house, layout, locality, landmark, subLocality, town, city, `${state} - ${pincode}`].filter(Boolean);
        const fullAddress = addrParts.join(', ');

        return {
            name,
            dob: formatDobToISO(dobRaw),
            gender: formatGender(genderRaw),
            address: {
                line1: fullAddress,
                city: city,
                state: state,
                pincode: pincode
            },
            aadhaarNumber: maskedMobile || 'QR-VERIFIED', 
            mobile: maskedMobile,
            email: maskedEmail
        };
    } catch (err) {
        console.error('Secure QR Decoding Error:', err);
        return null;
    }
};

export const parseAadhaarSecureText = (secureText: string): AadhaarData | null => {
    try {
        // SD-JWT Handling
        if (secureText.startsWith('eyJ')) {
            const jwtParts = secureText.split('.');
            if (jwtParts.length >= 2) {
                const payloadBase64 = jwtParts[1].replace(/-/g, '+').replace(/_/g, '/');
                const payload = JSON.parse(atob(payloadBase64));
                
                const disclosures = secureText.split('~').slice(1);
                const data: any = {
                    aadhaarNumber: 'QR-VERIFIED',
                    address: { line1: '', city: '', state: '', pincode: '' }
                };

                // If payload.id is 12 digits, use it as a starting point
                if (payload.id && /^\d{12}$/.test(payload.id)) {
                    data.aadhaarNumber = payload.id;
                }
                
                disclosures.forEach(d => {
                    try {
                        const base64 = d.trim().replace(/-/g, '+').replace(/_/g, '/');
                        const decoded = JSON.parse(atob(base64));
                        if (Array.isArray(decoded) && decoded.length >= 3) {
                            const key = decoded[1];
                            const val = decoded[2];
                            
                            // Aggressive search: if value is 12 digits, it's likely the Aadhaar number
                            if (/^\d{12}$/.test(String(val))) {
                                data.aadhaarNumber = String(val);
                            }

                            if (key === 'ResidentName' || key === 'Name') data.name = val;
                            if (key === 'Dob' || key === 'DOB') data.dob = formatDobToISO(val);
                            if (key === 'Gender') data.gender = formatGender(val);
                            if (key === 'Address') {
                                data.address.line1 = val;
                                const pcMatch = val.match(/\d{6}$/);
                                if (pcMatch) data.address.pincode = pcMatch[0];
                            }
                            if (key === 'Mobile') data.mobile = val;
                            if (key === 'Email') data.email = val;
                            if (key === 'ResidentImage' || key === 'Photo') data.photo = `data:image/jpeg;base64,${val}`;
                        }
                    } catch (e) {}
                });
                
                if (data.name) return data as AadhaarData;
            }
        }
// ... (rest of function unchanged, but ensure regex fallback in parseAadhaarZip picks up the 12 digits)

        const parts = secureText.split('~');
        if (parts.length < 5) return null;

        const extractValue = (key: string): string => {
            const searchKey = key.toLowerCase();
            for (let i = 1; i < parts.length; i++) {
                const part = parts[i].trim();
                if (!part) continue;
                try {
                    let base64 = part.replace(/-/g, '+').replace(/_/g, '/');
                    while (base64.length % 4) base64 += '=';
                    const binary = atob(base64);
                    const bytes = new Uint8Array(binary.length);
                    for (let j = 0; j < binary.length; j++) bytes[j] = binary.charCodeAt(j);
                    const decoded = new TextDecoder().decode(bytes);
                    if (decoded.startsWith('[') && decoded.endsWith(']')) {
                        const json = JSON.parse(decoded);
                        if (json.length >= 3 && String(json[1]).toLowerCase() === searchKey) {
                            return String(json[2]);
                        }
                        if (searchKey === 'uid' && json.length >= 3 && String(json[1]).toLowerCase().includes('uid')) {
                            if (/^\d{12}$/.test(String(json[2]))) return String(json[2]);
                        }
                    }
                } catch (e) {}
            }
            return '';
        };

        const uid = extractValue('Uid') || extractValue('aadhaarNumber');
        const name = extractValue('ResidentName') || extractValue('Name');
        const dob = extractValue('Dob');
        const gender = extractValue('Gender');
        const mobile = extractValue('Mobile');
        const email = extractValue('Email');
        const photoBase64 = extractValue('ResidentImage');
        const careOf = extractValue('CareOf');
        const enrollmentDate = extractValue('EnrollmentDate');
        const fullAddress = extractValue('Address');
        const pincode = extractValue('Pincode');
        const state = extractValue('State');
        const district = extractValue('District');
        const vtc = extractValue('Vtc');
        const building = extractValue('Building');
        const street = extractValue('Street');
        const locality = extractValue('Locality');
        
        let finalAddressLine = fullAddress;
        if (!fullAddress) {
             finalAddressLine = [building, street, locality].filter(Boolean).join(', ');
        }

        let finalUid = uid;
        if (!finalUid || finalUid === 'QR-VERIFIED') {
            for (let i = 1; i < parts.length; i++) {
                try {
                    const binary = atob(parts[i].trim().replace(/-/g, '+').replace(/_/g, '/'));
                    if (binary.includes('4852') || /\d{12}/.test(binary)) {
                        const match = binary.match(/\d{12}/);
                        if (match) {
                            finalUid = match[0];
                            break;
                        }
                    }
                } catch(e) {}
            }
        }

        if (!name && !finalUid) return null;

        return {
            name,
            dob: formatDobToISO(dob),
            gender: formatGender(gender),
            address: {
                line1: finalAddressLine,
                city: vtc || district,
                state: state,
                pincode: pincode
            },
            aadhaarNumber: finalUid || 'QR-VERIFIED',
            mobile: mobile,
            email: email,
            photo: photoBase64 ? `data:image/jpeg;base64,${photoBase64}` : undefined,
            careOf: careOf,
            enrollmentDate: enrollmentDate
        };
    } catch (e) {
        console.error('Secure Text Parse Error:', e);
        return null;
    }
};

export const parseAadhaarZip = async (file: File): Promise<AadhaarData | null> => {
    const zip = new JSZip();
    try {
        const contents = await zip.loadAsync(file);
        let foundText = '';
        let allZipText = '';
        
        for (const filename of Object.keys(contents.files)) {
            if (!contents.files[filename].dir) {
                const text = await contents.files[filename].async('string');
                allZipText += ' ' + text;
                if (!foundText && (text.includes('<?xml') || text.includes('~') || text.includes('ResidentName'))) {
                    foundText = text;
                }
            }
        }

        if (!foundText && !allZipText) return null;
        
        let data: AadhaarData | null = null;
        if (foundText) {
            if (foundText.includes('~')) data = parseAadhaarSecureText(foundText);
            else if (foundText.includes('<?xml')) data = parseAadhaarQR(foundText);
        }

        // Fallback: search for 12 digits in ALL text from the zip
        if (!data || !data.aadhaarNumber || !/^\d{12}$/.test(data.aadhaarNumber)) {
            const match = allZipText.match(/\d{12}/);
            if (match) {
                if (!data) {
                    data = {
                        name: '', dob: '', gender: '',
                        address: { line1: '', city: '', state: '', pincode: '' },
                        aadhaarNumber: match[0]
                    };
                } else {
                    data.aadhaarNumber = match[0];
                }
            }
        }
        
        return data;
    } catch (err) {
        console.error('Zip Error:', err);
    }
    return null;
};

export const isAgeAbove18 = (dobString: string) => {
    if (!dobString) return 'No';
    const date = new Date(dobString);
    if (isNaN(date.getTime())) return 'No';
    const age = differenceInYears(new Date(), date);
    return age >= 18 ? 'Yes' : 'No';
};
