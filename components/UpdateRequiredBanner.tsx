import React, { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';

/**
 * Compares two semver strings (e.g. "6.0.0" vs "7.0.0").
 * Returns true if `current` is older than `required`.
 */
export function isVersionOutdated(current: string, required: string): boolean {
  if (!current || !required) return false;
  const cur = current.split('.').map(Number);
  const req = required.split('.').map(Number);
  for (let i = 0; i < Math.max(cur.length, req.length); i++) {
    const c = cur[i] || 0;
    const r = req[i] || 0;
    if (c < r) return true;
    if (c > r) return false;
  }
  return false;
}

const DEFAULT_DOWNLOAD_URL = 'https://app.paradigmfms.com';

/**
 * Full-screen blocking banner shown when the app version is outdated.
 * Cannot be dismissed — the user must update.
 */
const UpdateRequiredBanner: React.FC = () => {
  const [downloadUrl, setDownloadUrl] = useState(DEFAULT_DOWNLOAD_URL);

  useEffect(() => {
    const fetchUpdateUrl = async () => {
      try {
        // Cache buster to ensure we get the latest version info
        const response = await fetch(`/version.json?t=${new Date().getTime()}`);
        if (response.ok) {
          const data = await response.json();
          // Prefer WhatsApp group URL if available, fallback to APK URL
          const url = data.whatsappGroupUrl || data.apkDownloadUrl || DEFAULT_DOWNLOAD_URL;
          setDownloadUrl(url);
        }
      } catch (error) {
        console.error('Failed to fetch update URL:', error);
      }
    };

    fetchUpdateUrl();
  }, []);

  const handleDownload = () => {
    if (Capacitor.isNativePlatform()) {
      // On native, open in system browser to trigger WhatsApp app redirection
      window.open(downloadUrl, '_system');
    } else {
      // On web, open in new tab
      window.open(downloadUrl, '_blank');
    }
  };

  const isWhatsApp = downloadUrl.includes('whatsapp.com') || downloadUrl.includes('wa.me');

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 99999,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #041b0f 0%, #0a3d23 50%, #062b1a 100%)',
      padding: '24px',
      textAlign: 'center',
    }}>
      {/* Icon */}
      <div style={{
        width: 80, height: 80, borderRadius: 20,
        background: 'rgba(0, 107, 63, 0.3)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 24,
        border: '2px solid rgba(0, 200, 100, 0.3)',
      }}>
        {isWhatsApp ? (
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#00c864" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 1 1-7.6-11.7c.9 0 1.8.1 2.6.4l4.9-1.3-1.3 4.9c.3.8.4 1.7.4 2.6Z" />
            <path d="m15.5 13-1.5 1.5-1.5-1.5" />
            <path d="M12 9v5" />
          </svg>
        ) : (
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#00c864" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
        )}
      </div>

      {/* Title */}
      <h1 style={{
        color: '#ffffff',
        fontSize: 22,
        fontWeight: 700,
        margin: '0 0 12px 0',
        letterSpacing: '-0.3px',
      }}>
        Update Required
      </h1>

      {/* Message */}
      <p style={{
        color: 'rgba(255,255,255,0.7)',
        fontSize: 15,
        lineHeight: 1.6,
        maxWidth: 340,
        margin: '0 0 32px 0',
      }}>
        A new version of <strong style={{ color: '#fff' }}>Paradigm IFS</strong> is available. 
        {isWhatsApp ? (
          <> Please join our <strong style={{ color: '#00c864' }}>WhatsApp Group</strong> to download the latest update.</>
        ) : (
          <> Please download and install the latest version to continue using the app.</>
        )}
      </p>

      {/* Download Button */}
      <button
        onClick={handleDownload}
        style={{
          background: isWhatsApp 
            ? 'linear-gradient(135deg, #128C7E, #25D366)' 
            : 'linear-gradient(135deg, #006B3F, #00a85a)',
          color: '#fff',
          border: 'none',
          borderRadius: 14,
          padding: '16px 48px',
          fontSize: 16,
          fontWeight: 700,
          cursor: 'pointer',
          boxShadow: isWhatsApp 
            ? '0 4px 24px rgba(37, 211, 102, 0.3)' 
            : '0 4px 24px rgba(0, 107, 63, 0.4)',
          transition: 'transform 0.15s, box-shadow 0.15s',
          letterSpacing: '0.3px',
        }}
        onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.97)')}
        onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
      >
        {isWhatsApp ? 'Join WhatsApp Group' : 'Download Now'}
      </button>

      {/* Subtle URL hint */}
      <p style={{
        color: 'rgba(255,255,255,0.35)',
        fontSize: 12,
        marginTop: 16,
      }}>
        {downloadUrl.replace('https://', '')}
      </p>

      {/* Instructions */}
      <div style={{
        marginTop: 32,
        padding: '16px 20px',
        background: 'rgba(255,255,255,0.05)',
        borderRadius: 12,
        maxWidth: 340,
        border: '1px solid rgba(255,255,255,0.08)',
      }}>
        <p style={{
          color: 'rgba(255,255,255,0.5)',
          fontSize: 13,
          lineHeight: 1.5,
          margin: 0,
        }}>
          {isWhatsApp ? (
            <>
              Click <strong style={{ color: 'rgba(255,255,255,0.7)' }}>Join WhatsApp Group</strong> →  
              Join the group → Download & Install the latest APK from group files.
            </>
          ) : (
            <>
              Click <strong style={{ color: 'rgba(255,255,255,0.7)' }}>Download Now</strong> →  
              Download the APK → Install and open the latest app
            </>
          )}
        </p>
      </div>
    </div>
  );
};

export default UpdateRequiredBanner;
