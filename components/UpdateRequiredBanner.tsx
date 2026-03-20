import React from 'react';
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

const DOWNLOAD_URL = 'https://app.paradigmfms.com';

/**
 * Full-screen blocking banner shown when the app version is outdated.
 * Cannot be dismissed — the user must update.
 */
const UpdateRequiredBanner: React.FC = () => {
  const handleDownload = () => {
    if (Capacitor.isNativePlatform()) {
      // On native, open in system browser
      window.open(DOWNLOAD_URL, '_system');
    } else {
      window.open(DOWNLOAD_URL, '_blank');
    }
  };

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
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#00c864" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
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
        Please download and install the latest version to continue using the app.
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
        }}
        onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.97)')}
        onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
      >
        Download Now
      </button>

      {/* Subtle URL hint */}
      <p style={{
        color: 'rgba(255,255,255,0.35)',
        fontSize: 12,
        marginTop: 16,
      }}>
        {DOWNLOAD_URL.replace('https://', '')}
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
          Click <strong style={{ color: 'rgba(255,255,255,0.7)' }}>Download Now</strong> →  
          Download the APK → Install and open the latest app
        </p>
      </div>
    </div>
  );
};

export default UpdateRequiredBanner;
