/**
 * Paradigm Local Attendance Analyzer Service
 * Connects frontend directly to scripts/local_attendance_analyzer.py via Express /api/paradigm-assist/analyze-file
 * Operates 100% locally on-premise without any cloud LLM dependency.
 */

export interface LocalAnalysisResult {
  success: boolean;
  answer: string;
  summary: {
    site_name: string;
    month_year: string;
    total_staff_count: number;
    total_payable_duties: number;
    total_present_days: number;
    total_double_duties: number;
    total_weekly_offs_credited: number;
    total_paid_holidays: number;
    total_absents: number;
  };
  employees: Array<{
    sl?: number;
    code: string;
    name: string;
    present_days: number;
    double_duties: number;
    weekly_offs: number;
    holidays: number;
    absent_days: number;
    payable_duties: number;
  }>;
  error?: string;
}

export async function analyzeDocumentWithLocalPython(
  file: File,
  question: string = 'total how many duties i need to pay?'
): Promise<LocalAnalysisResult> {
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const res = reader.result as string;
      const base64Data = res.split(',')[1] || res;
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const response = await fetch('/api/paradigm-assist/analyze-file', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fileBase64: base64,
      fileName: file.name,
      question
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Local analysis failed: ${errText || response.statusText}`);
  }

  return response.json();
}

export async function analyzeTextWithLocalPython(
  rawText: string,
  fileName: string = 'attendance_report.txt',
  question: string = 'total how many duties i need to pay?'
): Promise<LocalAnalysisResult> {
  const response = await fetch('/api/paradigm-assist/analyze-file', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      rawText,
      fileName,
      question
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Local text analysis failed: ${errText || response.statusText}`);
  }

  return response.json();
}

