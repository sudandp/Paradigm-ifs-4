import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import toast from 'react-hot-toast';
import { Copy, Download, Printer, AlertTriangle, ExternalLink } from 'lucide-react';
import Modal from '../../ui/Modal';
import { downloadFile } from '../../../utils/fileDownloader';
import { buildClickToChatLink, getHelpdeskNumber, type ChannelSite } from '../../../services/helpdeskChannelApi';
import { btnPrimary, btnSecondary, inputCls } from './helpdeskUi';

const POSTER_W = 1240; // A4 portrait @ 150 dpi
const POSTER_H = 1754;
const ACCENT = '#006B3F';
const TAGLINE = 'Scan to report an issue on WhatsApp';

const formatNumber = (digits: string) => (digits ? `+${digits}` : '');

const wrapText = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] => {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
};

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

/** Renders the full printable poster to a PNG data URL. */
const renderPoster = async (site: ChannelSite, link: string, helpdeskNumber: string): Promise<string> => {
  const canvas = document.createElement('canvas');
  canvas.width = POSTER_W;
  canvas.height = POSTER_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, POSTER_W, POSTER_H);

  // Header band
  ctx.fillStyle = ACCENT;
  ctx.fillRect(0, 0, POSTER_W, 260);
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 54px Arial, Helvetica, sans-serif';
  ctx.fillText('Facility Helpdesk', POSTER_W / 2, 105);
  ctx.font = '36px Arial, Helvetica, sans-serif';
  ctx.fillText(TAGLINE, POSTER_W / 2, 185);

  // Site name
  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 76px Arial, Helvetica, sans-serif';
  const nameLines = wrapText(ctx, site.display_name, POSTER_W - 160).slice(0, 2);
  let y = 370;
  nameLines.forEach(l => { ctx.fillText(l, POSTER_W / 2, y); y += 90; });

  // QR
  const qrSize = 820;
  const qrUrl = await QRCode.toDataURL(link, { width: qrSize, margin: 2, errorCorrectionLevel: 'M', color: { dark: '#000000', light: '#FFFFFF' } });
  const qrImg = await loadImage(qrUrl);
  const qrY = y + 10;
  ctx.strokeStyle = ACCENT;
  ctx.lineWidth = 8;
  ctx.strokeRect((POSTER_W - qrSize) / 2 - 20, qrY - 20, qrSize + 40, qrSize + 40);
  ctx.drawImage(qrImg, (POSTER_W - qrSize) / 2, qrY, qrSize, qrSize);

  // Footer
  let fy = qrY + qrSize + 100;
  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 44px Arial, Helvetica, sans-serif';
  ctx.fillText(`Site code: ${site.site_code}`, POSTER_W / 2, fy);
  fy += 70;
  ctx.fillStyle = '#475569';
  ctx.font = '34px Arial, Helvetica, sans-serif';
  const hint = `No camera? WhatsApp ${formatNumber(helpdeskNumber)} with "SITE:${site.site_code}" followed by your issue.`;
  wrapText(ctx, hint, POSTER_W - 200).forEach(l => { ctx.fillText(l, POSTER_W / 2, fy); fy += 48; });
  fy += 20;
  ctx.font = '30px Arial, Helvetica, sans-serif';
  ctx.fillText('Send a photo, the tower / floor and a short description.', POSTER_W / 2, fy);

  return canvas.toDataURL('image/png');
};

const printPoster = (posterDataUrl: string, title: string) => {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc || !iframe.contentWindow) {
    document.body.removeChild(iframe);
    throw new Error('Printing is not supported here');
  }
  doc.open();
  doc.write(`<!doctype html><html><head><title>${title.replace(/</g, '&lt;')}</title>
    <style>@page{size:A4 portrait;margin:8mm}html,body{margin:0;padding:0}
    img{display:block;width:100%;height:auto;max-height:100vh;object-fit:contain;margin:0 auto}</style>
    </head><body><img id="poster" src="${posterDataUrl}" /></body></html>`);
  doc.close();
  const win = iframe.contentWindow;
  const img = doc.getElementById('poster') as HTMLImageElement | null;
  const go = () => {
    win.focus();
    win.print();
    setTimeout(() => { if (iframe.parentNode) iframe.parentNode.removeChild(iframe); }, 2000);
  };
  if (img && !img.complete) img.onload = go; else setTimeout(go, 50);
};

interface Props {
  site: ChannelSite | null;
  onClose: () => void;
}

const SiteQrPosterModal: React.FC<Props> = ({ site, onClose }) => {
  const helpdeskNumber = getHelpdeskNumber();
  const link = site && helpdeskNumber ? buildClickToChatLink(helpdeskNumber, site.site_code) : '';
  const [poster, setPoster] = useState<string>('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setPoster('');
    if (!site || !link) return;
    renderPoster(site, link, helpdeskNumber)
      .then(url => { if (!cancelled) setPoster(url); })
      .catch(err => toast.error(err?.message || 'Failed to generate QR'));
    return () => { cancelled = true; };
  }, [site, link, helpdeskNumber]);

  if (!site) return null;

  const fileBase = `whatsapp-helpdesk-${site.site_code.toLowerCase()}`;

  const handleDownload = async () => {
    if (!poster) return;
    setBusy(true);
    try {
      await downloadFile(poster, `${fileBase}.png`, 'image/png');
    } catch (e: any) {
      toast.error(e?.message || 'Download failed');
    } finally {
      setBusy(false);
    }
  };

  const handlePrint = () => {
    if (!poster) return;
    try {
      printPoster(poster, `${site.display_name} - WhatsApp Helpdesk`);
    } catch (e: any) {
      toast.error(e?.message || 'Print failed. Download the PNG and print it instead.');
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      toast.success('Link copied');
    } catch {
      toast.error('Could not copy. Select the link and copy manually.');
    }
  };

  return (
    <Modal
      isOpen={!!site}
      onClose={onClose}
      title={`QR poster: ${site.display_name}`}
      maxWidth="md:max-w-2xl"
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className={btnSecondary} onClick={onClose}>Close</button>
          <button type="button" className={btnSecondary} onClick={handlePrint} disabled={!poster}>
            <Printer className="h-4 w-4" /> Print
          </button>
          <button type="button" className={btnPrimary} onClick={handleDownload} disabled={!poster || busy}>
            <Download className="h-4 w-4" /> Download PNG
          </button>
        </div>
      }
    >
      {!helpdeskNumber ? (
        <div className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900">
          <AlertTriangle className="h-5 w-5 flex-shrink-0" />
          <div>
            <p className="font-semibold">Helpdesk WhatsApp number is not configured.</p>
            <p className="mt-1 text-xs">
              Set <code className="rounded bg-white/70 px-1">VITE_WA_HELPDESK_NUMBER</code> (digits with country code,
              e.g. 919876543210) in the app environment and rebuild to generate QR codes.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {!site.is_active && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              This site is inactive. The bot will reject reports for it until it is re-activated.
            </div>
          )}
          <div>
            <span className="mb-1 block text-xs font-semibold text-muted">Click-to-chat link</span>
            <div className="flex gap-2">
              <input readOnly value={link} className={`${inputCls} font-mono text-xs`} onFocus={e => e.currentTarget.select()} />
              <button type="button" className={btnSecondary} onClick={handleCopy} title="Copy link"><Copy className="h-4 w-4" /></button>
              <a className={btnSecondary} href={link} target="_blank" rel="noreferrer" title="Open link"><ExternalLink className="h-4 w-4" /></a>
            </div>
          </div>
          <div className="flex justify-center rounded-lg border border-border bg-page p-3">
            {poster ? (
              <img src={poster} alt={`QR poster for ${site.display_name}`} className="h-auto w-full max-w-sm rounded shadow-sm" />
            ) : (
              <div className="py-16 text-sm text-muted">Generating poster...</div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
};

export default SiteQrPosterModal;
