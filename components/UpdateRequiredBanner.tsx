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
          // Store WhatsApp URL just for the support button
          const url = data.whatsappGroupUrl || 'https://wa.me/';
          setDownloadUrl(url);
        }
      } catch (error) {
        console.error('Failed to fetch update URL:', error);
      }
    };

    fetchUpdateUrl();
  }, []);

  const handleDownload = () => {
    const playStoreUrl = 'market://details?id=com.paradigm.ifs';
    const fallbackUrl = 'https://play.google.com/store/apps/details?id=com.paradigm.ifs';

    if (Capacitor.isNativePlatform()) {
      window.open(playStoreUrl, '_system');
    } else {
      window.open(fallbackUrl, '_blank');
    }
  };

  const handleSupport = () => {
    if (Capacitor.isNativePlatform()) {
      window.open(downloadUrl, '_system');
    } else {
      window.open(downloadUrl, '_blank');
    }
  };

  const isWhatsApp = false; // Disable WhatsApp styling for the main button

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
          background: 'linear-gradient(135deg, #006B3F, #00a85a)',
          color: '#fff',
          border: 'none',
          borderRadius: 14,
          padding: '16px 48px',
          fontSize: 16,
          fontWeight: 700,
          cursor: 'pointer',
          boxShadow: '0 4px 24px rgba(0, 107, 63, 0.4)',
          transition: 'transform 0.15s, box-shadow 0.15s',
          letterSpacing: '0.3px',
          marginBottom: 16,
          width: '100%',
          maxWidth: 340,
        }}
        onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.97)')}
        onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
      >
        Update on Play Store
      </button>

      {/* Support Button */}
      <button
        onClick={handleSupport}
        style={{
          background: 'transparent',
          color: '#fff',
          border: '1px solid rgba(255,255,255,0.2)',
          borderRadius: 14,
          padding: '16px 48px',
          fontSize: 16,
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'background 0.15s',
          width: '100%',
          maxWidth: 340,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px'
        }}
        onMouseOver={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
        onMouseOut={(e) => (e.currentTarget.style.background = 'transparent')}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 1 1-7.6-11.7c.9 0 1.8.1 2.6.4l4.9-1.3-1.3 4.9c.3.8.4 1.7.4 2.6Z" />
        </svg>
        Contact Support
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
          Click <strong style={{ color: 'rgba(255,255,255,0.7)' }}>Update on Play Store</strong> →  
          Download the latest version → Open the app
        </p>
      </div>
    </div>
  );
};

export default UpdateRequiredBanner;
