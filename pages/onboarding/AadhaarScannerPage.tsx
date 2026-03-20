import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import jsQR from 'jsqr';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, RefreshCw, Zap, ZapOff, Upload, CheckCircle2, XCircle, Calendar, MapPin, Phone, Mail, User, CreditCard, UserCheck, Users } from 'lucide-react';
import JSZip from 'jszip';
import { differenceInYears } from 'date-fns';
import { useOnboardingStore } from '../../store/onboardingStore';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';

import { AadhaarData, formatNameToTitleCase, formatGender, parseAadhaarQR, decodeSecureQR, parseAadhaarSecureText, isAgeAbove18 } from '../../utils/aadhaarUtils';

const AadhaarScannerPage: React.FC = () => {
    const navigate = useNavigate();
    const store = useOnboardingStore();
    const [isInitializing, setIsInitializing] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isFlashOn, setIsFlashOn] = useState(false);
    const [hasFlash, setHasFlash] = useState(false);
    const [isScanningFile, setIsScanningFile] = useState(false);
    const [scannedData, setScannedData] = useState<AadhaarData | null>(null);
    const [isReviewOpen, setIsReviewOpen] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const scannerRef = useRef<Html5Qrcode | null>(null);
    const qrCodeRegionId = "qr-reader-full-page";


    const stopScanner = async () => {
        if (scannerRef.current) {
            try {
                if (scannerRef.current.isScanning) {
                    await scannerRef.current.stop();
                }
                // Don't call clear() immediately if we might need the object for file scanning
                // but for this implementation we recreate it if needed.
            } catch (err) {
                console.error('Error stopping scanner:', err);
            }
        }
    };

    const handleScanSuccess = async (aadhaarData: AadhaarData) => {
        await stopScanner();
        setScannedData(aadhaarData);
        setIsReviewOpen(true);
    };

    const confirmAndFill = () => {
        if (!scannedData) return;
        
        const aadhaarData = scannedData;
        const nameParts = aadhaarData.name.split(' ');
        const firstName = formatNameToTitleCase(nameParts.shift() || '');
        const lastName = formatNameToTitleCase(nameParts.pop() || '');
        const middleName = formatNameToTitleCase(nameParts.join(' '));

        store.updatePersonal({
            firstName,
            lastName,
            middleName,
            preferredName: firstName,
            dob: aadhaarData.dob,
            gender: aadhaarData.gender as any,
            idProofType: 'Aadhaar',
            idProofNumber: aadhaarData.aadhaarNumber, 
            mobile: aadhaarData.mobile,
            email: aadhaarData.email,
            isQrVerified: true
        });

        store.updateAddress({
            present: {
                line1: aadhaarData.address.line1,
                city: aadhaarData.address.city,
                state: aadhaarData.address.state,
                pincode: aadhaarData.address.pincode,
                country: 'India',
                verifiedStatus: {
                    line1: true,
                    city: true,
                    state: true,
                    pincode: true,
                    country: true
                }
            },
            permanent: {
                line1: aadhaarData.address.line1,
                city: aadhaarData.address.city,
                state: aadhaarData.address.state,
                pincode: aadhaarData.address.pincode,
                country: 'India'
            },
            sameAsPresent: true
        });

        store.setPersonalVerifiedStatus({
            name: true,
            dob: true,
            idProofNumber: false,
            email: !!aadhaarData.email
        });

        navigate('/onboarding/add/personal');
    };

    const startScanner = async () => {
        try {
            setError(null);
            setIsInitializing(true);

            const html5QrCode = new Html5Qrcode(qrCodeRegionId);
            scannerRef.current = html5QrCode;

            const config = {
                fps: 60, // Increased FPS for better tracking
                qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
                    const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
                    const boxSize = Math.floor(minEdge * 0.95); // Even larger box for dense codes
                    return { width: boxSize, height: boxSize };
                },
                aspectRatio: 1.0,
                videoConstraints: {
                    facingMode: "environment",
                    width: { min: 1280, ideal: 1920, max: 2560 }, // Request high res
                    height: { min: 720, ideal: 1080, max: 1440 },
                    frameRate: { ideal: 60 }
                }
            };

            await html5QrCode.start(
                { facingMode: "environment" },
                config,
                async (decodedText) => {
                    let parsedData: AadhaarData | null = null;
                    
                    if (decodedText.includes('~')) {
                        parsedData = parseAadhaarSecureText(decodedText);
                    } else if (/^\d+$/.test(decodedText) && decodedText.length > 500) {
                        setIsInitializing(true);
                        parsedData = await decodeSecureQR(decodedText);
                        setIsInitializing(false);
                    } else {
                        parsedData = parseAadhaarQR(decodedText);
                    }

                    if (parsedData) {
                        try {
                            if (window.navigator && window.navigator.vibrate) {
                                window.navigator.vibrate(100);
                            }
                        } catch (e) {}
                        handleScanSuccess(parsedData);
                    }
                },
                () => {}
            );
            
            try {
                const capabilities = await html5QrCode.getRunningTrackCapabilities();
                if (capabilities && (capabilities as any).torch) {
                    setHasFlash(true);
                }
            } catch (e) {
                console.log("Torch capability check failed", e);
            }
            
            setIsInitializing(false);
        } catch (err: any) {
            console.error('Scanner error:', err);
            setError(`Camera error: ${err.message || 'Access denied'}`);
            setIsInitializing(false);
        }
    };

    const handleRetry = () => {
        setIsFlashOn(false);
        if (scannerRef.current?.isScanning) {
            scannerRef.current.stop().then(() => startScanner());
        } else {
            startScanner();
        }
    };

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            setIsScanningFile(true);
            setError(null);
            
            // 0. Preliminary: Stop camera if running
            if (scannerRef.current?.isScanning) {
                await scannerRef.current.stop();
            }

            // --- ZIP FILE HANDLING ---
            if (file.name.endsWith('.zip') || file.type === 'application/zip' || file.type === 'application/x-zip-compressed') {
                const zip = new JSZip();
                try {
                    const contents = await zip.loadAsync(file);
                    let foundText = '';
                    
                    // Look for the offline XML/Data file. usually 'offlineaadhaar202...'
                    // We iterate and try to find a file that contains XML or the new text format
                    for (const filename of Object.keys(contents.files)) {
                        if (!contents.files[filename].dir) {
                            const textProps = await contents.files[filename].async('string');
                            if (textProps.includes('<?xml') || textProps.includes('~') || textProps.includes('ResidentName')) {
                                foundText = textProps;
                                break;
                            }
                        }
                    }

                    if (!foundText) {
                        throw new Error("No valid Aadhaar data file found inside the zip.");
                    }

                    let parsedData: AadhaarData | null = null;
                    if (foundText.includes('~')) {
                         parsedData = parseAadhaarSecureText(foundText);
                    } else if (foundText.includes('<?xml')) {
                         parsedData = parseAadhaarQR(foundText);
                    }

                    if (parsedData) {
                        handleScanSuccess(parsedData);
                    } else {
                        setError("Could not parse Aadhaar data from the zip file.");
                    }
                } catch (zipErr: any) {
                    console.error('Zip Error:', zipErr);
                    setError(zipErr.message || "Failed to read zip file.");
                } finally {
                    setIsScanningFile(false);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                }
                return; // Stop here for zip files
            }

            // --- IMAGE FILE HANDLING ---
            // Create a temporary scanner instance if needed
            const html5QrCode = scannerRef.current || new Html5Qrcode(qrCodeRegionId);
            
            let decodedText = '';

            // 1. FIRST PASS: Native html5-qrcode file scanning (often better at thresholding)
            try {
                decodedText = await html5QrCode.scanFile(file, false);
            } catch (scanErr) {
                // Native engine failed, move to custom jsQR pipeline
                console.log("Native file scan failed, trying custom pipeline...");
            }

            // 2. SECOND PASS: Custom jsQR Multi-filter Pipeline
            if (!decodedText) {
                decodedText = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        const img = new Image();
                        img.onload = () => {
                            const canvas = document.createElement('canvas');
                            const ctx = canvas.getContext('2d', { willReadFrequently: true });
                            if (!ctx) return reject(new Error('Canvas setup failed'));

                            // Optimization: If image is huge, downscale it to help jsQR
                            const MAX_DIM = 1200;
                            let width = img.width;
                            let height = img.height;
                            if (width > MAX_DIM || height > MAX_DIM) {
                                if (width > height) {
                                    height = Math.floor((MAX_DIM / width) * height);
                                    width = MAX_DIM;
                                } else {
                                    width = Math.floor((MAX_DIM / height) * width);
                                    height = MAX_DIM;
                                }
                            }
                            canvas.width = width;
                            canvas.height = height;

                            const tryPass = (filter: string) => {
                                ctx.filter = filter;
                                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                                return jsQR(imageData.data, canvas.width, canvas.height);
                            };

                            // Aggressive retry logic with different levels of processing
                            let code = tryPass('none');
                            if (!code) code = tryPass('contrast(130%) grayscale(100%)');
                            if (!code) code = tryPass('contrast(160%) brightness(110%) grayscale(100%)');
                            if (!code) code = tryPass('contrast(300%) grayscale(100%)'); // Thresholding-like
                            if (!code) code = tryPass('contrast(100%) brightness(140%) grayscale(100%)'); // Very dark
                            if (!code) code = tryPass('invert(100%) contrast(120%) grayscale(100%)'); // Inverted version

                            if (code) resolve(code.data);
                            else reject(new Error('No QR code found after multiple checks'));
                        };
                        img.src = e.target?.result as string;
                    };
                    reader.readAsDataURL(file);
                });
            }

            // 3. Decoding logic
            let parsedData: AadhaarData | null = null;
            if (decodedText.includes('~')) {
                parsedData = parseAadhaarSecureText(decodedText);
            } else if (/^\d+$/.test(decodedText) && decodedText.length > 500) {
                parsedData = await decodeSecureQR(decodedText);
            } else {
                parsedData = parseAadhaarQR(decodedText);
            }

            if (parsedData) {
                handleScanSuccess(parsedData);
            } else {
                setError("Decoded text did not contain valid Aadhaar data. Please ensure it's a Secure Aadhaar QR.");
            }
        } catch (err: any) {
            console.error('File scan error:', err);
            setError("Could not find a clear Aadhaar QR in this image. Please ensure the QR is flat, well-lit, and not blurry.");
        } finally {
            setIsScanningFile(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const toggleFlash = async () => {
        if (!scannerRef.current || !hasFlash) return;
        try {
            const newState = !isFlashOn;
            await scannerRef.current.applyVideoConstraints({
                advanced: [{ torch: newState }]
            } as any);
            setIsFlashOn(newState);
        } catch (err) {
            console.error('Flash toggle failed:', err);
        }
    };

    useEffect(() => {
        if (!isReviewOpen) {
            const timer = setTimeout(() => {
                startScanner();
            }, 500);
            
            return () => {
                clearTimeout(timer);
                stopScanner();
            };
        } else {
            stopScanner();
        }
    }, [isReviewOpen]);

    if (isReviewOpen && scannedData) {
        return (
            <div className="fixed inset-0 z-[300] flex flex-col bg-gray-100 text-gray-900 animate-fade-in">
                <header className="p-6 bg-white border-b border-gray-200 flex items-center gap-4">
                    <Button 
                        variant="icon" 
                        className="!text-gray-600 bg-gray-100 hover:bg-gray-200 !p-2 !rounded-full" 
                        onClick={() => setIsReviewOpen(false)}
                    >
                        <ArrowLeft className="h-6 w-6" />
                    </Button>
                    <h2 className="text-xl font-bold tracking-tight">Verify Extracted Details</h2>
                </header>

                <main className="flex-1 overflow-y-auto p-4 space-y-4">
                    <div className="bg-white rounded-3xl p-5 shadow-lg space-y-6 text-gray-900">
                        
                        {/* Photo Section */}
                        <div className="flex items-center gap-4 border-b border-gray-100 pb-4">
                            <div className="relative">
                                {scannedData.photo ? (
                                    <img 
                                        src={scannedData.photo} 
                                        alt="Resident" 
                                        className="w-16 h-16 rounded-full object-cover border border-gray-200"
                                    />
                                ) : (
                                    <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
                                        <User className="h-8 w-8 text-green-500" />
                                    </div>
                                )}
                            </div>
                            <div>
                                <h3 className="font-bold text-lg">Your photo</h3>
                                <p className="text-gray-500 text-sm">Your digital photo saved on Aadhaar</p>
                            </div>
                        </div>

                        {/* Details List */}
                        <div className="space-y-5">
                            {/* Name */}
                            <div className="flex gap-4 border-b border-gray-100 pb-4">
                                <User className="h-6 w-6 text-green-500 mt-0.5" />
                                <div>
                                    <label className="block font-bold text-gray-900">Full name</label>
                                    <p className="text-green-500">{scannedData.name}</p>
                                </div>
                            </div>

                            {/* Aadhaar Number */}
                            <div className="flex gap-4 border-b border-gray-100 pb-4">
                                <CreditCard className="h-6 w-6 text-green-500 mt-0.5" />
                                <div>
                                    <label className="block font-bold text-gray-900">Aadhaar Number</label>
                                    <p className="text-green-500 tracking-wider font-mono">
                                        {scannedData.aadhaarNumber.length === 12 
                                            ? scannedData.aadhaarNumber.replace(/(.{4})/g, '$1 ').trim() 
                                            : scannedData.aadhaarNumber}
                                    </p>
                                </div>
                            </div>

                            {/* Age */}
                            <div className="flex gap-4 border-b border-gray-100 pb-4">
                                <UserCheck className="h-6 w-6 text-green-500 mt-0.5" />
                                <div>
                                    <label className="block font-bold text-gray-900">Age Above 18</label>
                                    <p className="text-green-500">{isAgeAbove18(scannedData.dob)}</p>
                                </div>
                            </div>

                            {/* DOB */}
                            <div className="flex gap-4 border-b border-gray-100 pb-4">
                                <Calendar className="h-6 w-6 text-green-500 mt-0.5" />
                                <div>
                                    <label className="block font-bold text-gray-900">Date of Birth</label>
                                    <p className="text-green-500">{scannedData.dob}</p>
                                </div>
                            </div>

                            {/* Enrollment Date */}
                            {scannedData.enrollmentDate && (
                                <div className="flex gap-4 border-b border-gray-100 pb-4">
                                    <Calendar className="h-6 w-6 text-green-500 mt-0.5" />
                                    <div>
                                        <label className="block font-bold text-gray-900">Enrollment Date</label>
                                        <p className="text-green-500">{scannedData.enrollmentDate.split('T')[0]}</p>
                                    </div>
                                </div>
                            )}

                            {/* Gender */}
                            <div className="flex gap-4 border-b border-gray-100 pb-4">
                                <User className="h-6 w-6 text-green-500 mt-0.5" />
                                <div>
                                    <label className="block font-bold text-gray-900">Gender</label>
                                    <p className="text-green-500 uppercase">{scannedData.gender}</p>
                                </div>
                            </div>

                            {/* Care Of */}
                            <div className="flex gap-4 border-b border-gray-100 pb-4">
                                <Users className="h-6 w-6 text-green-500 mt-0.5" />
                                <div>
                                    <label className="block font-bold text-gray-900">Care of / Guardian</label>
                                    <p className="text-green-500 capitalize">{scannedData.careOf || 'N/A'}</p>
                                </div>
                            </div>

                            {/* Address */}
                            <div className="flex gap-4 border-b border-gray-100 pb-4">
                                <MapPin className="h-6 w-6 text-green-500 mt-0.5" />
                                <div>
                                    <label className="block font-bold text-gray-900">Address</label>
                                    <p className="text-green-500 text-sm leading-relaxed">
                                        {scannedData.address.line1}
                                        {scannedData.address.line1 ? ', ' : ''}
                                        {scannedData.address.city}, {scannedData.address.state} {scannedData.address.pincode}
                                    </p>
                                </div>
                            </div>

                            {/* Mobile */}
                            <div className="flex gap-4 border-b border-gray-100 pb-4">
                                <Phone className="h-6 w-6 text-green-500 mt-0.5" />
                                <div>
                                    <label className="block font-bold text-gray-900">Mobile Number</label>
                                    <p className="text-green-500 text-sm font-medium">
                                        {scannedData.mobile || 'N/A'}
                                    </p>
                                </div>
                            </div>

                            {/* Email */}
                            <div className="flex gap-4 pb-2">
                                <Mail className="h-6 w-6 text-green-500 mt-0.5" />
                                <div>
                                    <label className="block font-bold text-gray-900">Email</label>
                                    <p className="text-green-500 text-sm break-all">
                                        {scannedData.email || 'N/A'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </main>

                <footer className="p-6 bg-white border-t border-gray-100">
                     <div className="flex flex-col gap-3">
                        <Button 
                            className="w-full !rounded-2xl !py-4 font-bold text-lg shadow-lg"
                            onClick={confirmAndFill}
                        >
                            Confirm & Auto-Fill
                        </Button>
                        <Button 
                            variant="secondary"
                            className="w-full !rounded-2xl !py-4 !bg-gray-100 !border-gray-200 !text-gray-600 font-medium"
                            onClick={() => setIsReviewOpen(false)}
                        >
                            Rescan QR Code
                        </Button>
                     </div>
                </footer>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-[250] flex flex-col bg-black text-white">
            <header className="p-6 border-b border-emerald-900/30 flex items-center gap-4 bg-gradient-to-b from-[#01140a] to-transparent">
                <Button 
                    variant="icon" 
                    className="!text-white bg-white/5 hover:!bg-white/10 !p-2 !rounded-full" 
                    onClick={() => navigate(-1)}
                >
                    <ArrowLeft className="h-6 w-6" />
                </Button>
                <h2 className="text-xl font-bold tracking-tight flex-1">Scan Aadhaar QR</h2>
                
                {hasFlash && (
                    <Button 
                        variant="icon" 
                        className={`!p-2 !rounded-full ${isFlashOn ? 'bg-yellow-500/20 !text-yellow-400' : 'bg-white/5 !text-white'} hover:!bg-white/10`}
                        onClick={toggleFlash}
                    >
                        {isFlashOn ? <Zap className="h-6 w-6" /> : <ZapOff className="h-6 w-6" />}
                    </Button>
                )}
            </header>

            <div className="flex-grow relative flex items-center justify-center overflow-hidden bg-black">
                {isInitializing && !isScanningFile && (
                    <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black">
                        <Loader2 className="h-12 w-12 animate-spin text-accent" />
                        <p className="mt-4 text-white/70 font-medium">Initializing scanner...</p>
                    </div>
                )}

                {isScanningFile && (
                    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm">
                        <Loader2 className="h-12 w-12 animate-spin text-white" />
                        <p className="mt-4 text-white font-medium text-lg">Processing Image...</p>
                    </div>
                )}

                {error && (
                    <div className="absolute inset-0 z-[60] flex flex-col items-center justify-center text-white p-6 text-center bg-black/80">
                        <p className="mb-6 text-red-400">{error}</p>
                        <div className="flex gap-4">
                            <Button onClick={handleRetry} className="!rounded-full !px-6">Try Again</Button>
                            <Button onClick={() => navigate(-1)} variant="secondary" className="!rounded-full !px-6">Cancel</Button>
                        </div>
                    </div>
                )}

                <div 
                    id={qrCodeRegionId} 
                    className="w-full h-full max-h-screen [&_video]:object-cover [&_video]:w-full [&_video]:h-full"
                ></div>

                {!isInitializing && !error && (
                    <div className="absolute inset-0 z-30 pointer-events-none flex flex-col items-center justify-center">
                        <div className="w-80 h-80 border-2 border-accent rounded-3xl relative shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]">
                            <div className="absolute inset-x-0 h-0.5 bg-accent/50 shadow-[0_0_15px_#006b3f] animate-[scan_2s_linear_infinite]"></div>
                            <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-accent rounded-tl-xl"></div>
                            <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-accent rounded-tr-xl"></div>
                            <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-accent rounded-bl-xl"></div>
                            <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-accent rounded-br-xl"></div>
                        </div>
                        <h3 className="mt-6 text-xl font-bold text-white drop-shadow-md">Scan Aadhaar QR</h3>
                        <p className="mt-3 text-white/80 text-sm font-medium px-6 text-center">
                            Hold the QR code within the square to scan
                        </p>
                    </div>
                )}
            </div>

            <div className="absolute bottom-[61px] left-0 right-0 px-6 pb-4 z-40 flex flex-col gap-4 items-center">
                 {!isInitializing && !isScanningFile && (
                    <div className="flex flex-col gap-3 w-full max-w-sm">
                        <div className="flex gap-4">
                            <Button 
                                variant="secondary" 
                                className="flex-1 !rounded-2xl !py-5 !bg-white/10 !border-white/20 !text-white hover:!bg-white/20 backdrop-blur-md shadow-lg text-lg font-bold"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <Upload className="h-6 w-6 mr-3" />
                                Upload Image / Zip
                            </Button>
                            <Button 
                                variant="icon" 
                                className="!rounded-2xl !bg-white/10 !border-white/20 !text-white hover:!bg-white/20 backdrop-blur-md shadow-lg !p-5"
                                onClick={handleRetry}
                            >
                                <RefreshCw className="h-7 w-7" />
                            </Button>
                        </div>
                    </div>
                 )}

                 <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept="image/*,application/zip,.zip,.xml" 
                    onChange={handleFileUpload}
                 />
            </div>

            <style>{`
                @keyframes scan {
                    0% { top: 0; }
                    50% { top: 100%; }
                    100% { top: 0; }
                }
                #${qrCodeRegionId} > div {
                    display: none !important;
                }
                #${qrCodeRegionId} video {
                    width: 100% !important;
                    height: 100% !important;
                    object-fit: cover !important;
                }
            `}</style>
        </div>
    );
};

export default AadhaarScannerPage;
