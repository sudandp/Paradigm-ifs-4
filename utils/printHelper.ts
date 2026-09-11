import { Capacitor } from '@capacitor/core';
import { downloadFile } from './fileDownloader';

/**
 * Universal print handler that provides parity across Web and Native:
 * - On Web: triggers browser print dialog (window.print()).
 * - On Native (Android / iOS): captures the specified DOM element (or main document)
 *   via html2canvas, generates a high-quality PDF via jsPDF, and invokes downloadFile()
 *   to launch the system share sheet / print intent.
 */
export async function triggerPrint(elementId?: string, defaultTitle: string = 'Document'): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    window.print();
    return;
  }

  try {
    const targetElement = elementId 
      ? document.getElementById(elementId) 
      : (document.querySelector('main') || document.body);

    if (!targetElement) {
      window.print();
      return;
    }

    const html2canvasModule = await import('html2canvas');
    const html2canvas = (html2canvasModule.default || html2canvasModule) as any;
    const jsPdfModule = await import('jspdf');
    const jsPDF = (jsPdfModule.default || jsPdfModule.jsPDF || jsPdfModule) as any;

    const canvas = await html2canvas(targetElement as HTMLElement, {
      scale: 2,
      useCORS: true,
      logging: false,
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    const pdf = new jsPDF({
      orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
      unit: 'px',
      format: [canvas.width, canvas.height],
    });

    pdf.addImage(imgData, 'JPEG', 0, 0, canvas.width, canvas.height);
    const pdfBlob = pdf.output('blob');
    const fileName = `${defaultTitle.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`;

    await downloadFile(pdfBlob, fileName, 'application/pdf');
  } catch (err) {
    console.error('[printHelper] Native print capture failed, attempting window.print fallback:', err);
    try {
      window.print();
    } catch {
      // Print not supported in current environment
    }
  }
}
