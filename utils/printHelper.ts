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
    if (elementId) {
      const targetElement = document.getElementById(elementId);
      if (targetElement) {
        // Create an isolated hidden iframe specifically for printing the targeted element cleanly
        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        iframe.setAttribute('aria-hidden', 'true');
        document.body.appendChild(iframe);

        const doc = iframe.contentWindow?.document;
        if (doc) {
          doc.open();
          doc.write(`
            <!DOCTYPE html>
            <html>
              <head>
                <title>${defaultTitle}</title>
                <meta charset="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                <style>
                  @page {
                    size: A4 portrait;
                    margin: 10mm;
                  }
                  body {
                    margin: 0;
                    padding: 0;
                    background: white !important;
                    color: #0f172a;
                    font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                  }
                  * {
                    box-sizing: border-box;
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                  }
                  .print\\:hidden, .no-print {
                    display: none !important;
                  }
                  img {
                    max-width: 100%;
                  }
                </style>
              </head>
              <body>
                ${targetElement.outerHTML}
              </body>
            </html>
          `);
          doc.close();

          // Copy all active styles and Tailwind stylesheets into the print iframe
          document.querySelectorAll('link[rel="stylesheet"], style').forEach((node) => {
            try {
              doc.head.appendChild(node.cloneNode(true));
            } catch {
              // ignore
            }
          });

          // Allow styles and images to settle, then open print dialog
          setTimeout(() => {
            try {
              iframe.contentWindow?.focus();
              iframe.contentWindow?.print();
            } catch (printErr) {
              console.warn('[printHelper] Iframe print failed, fallback to window.print:', printErr);
              window.print();
            } finally {
              setTimeout(() => {
                if (document.body.contains(iframe)) {
                  document.body.removeChild(iframe);
                }
              }, 1500);
            }
          }, 350);
          return;
        }
      }
    }

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
