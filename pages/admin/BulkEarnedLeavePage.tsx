import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { api } from '../../services/api';
import Button from '../../components/ui/Button';
import { Download, Upload, AlertCircle, CheckCircle2, Loader2, FileSpreadsheet, ArrowLeft, Info } from 'lucide-react';
import { format } from 'date-fns';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import Toast from '../../components/ui/Toast';

const BulkEarnedLeavePage: React.FC = () => {
    const navigate = useNavigate();
    const [isDownloading, setIsDownloading] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [previewData, setPreviewData] = useState<any[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    const downloadTemplate = async () => {
        setIsDownloading(true);
        setError(null);
        try {
            const users = await api.getUsers(); // Get all users
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Earned Leaves');

            worksheet.columns = [
                { header: 'User ID', key: 'id', width: 40 },
                { header: 'Employee Name', key: 'name', width: 30 },
                { header: 'Earned Leave Balance', key: 'balance', width: 20 },
                { header: 'Opening Date (YYYY-MM-DD)', key: 'openingDate', width: 25 },
            ];

            // Add sample instructions or styling
            worksheet.getRow(1).font = { bold: true };
            worksheet.getRow(1).fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFE0E0E0' }
            };

            users.forEach((u: any) => {
                worksheet.addRow({
                    id: u.id,
                    name: u.name,
                    balance: u.earnedLeaveOpeningBalance || 0,
                    openingDate: u.earnedLeaveOpeningDate || format(new Date(), 'yyyy-MM-dd')
                });
            });

            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            saveAs(blob, `Earned_Leaves_Update_Template_${format(new Date(), 'yyyyMMdd')}.xlsx`);
            setToast({ message: 'Template downloaded successfully!', type: 'success' });
        } catch (err) {
            console.error('Download error:', err);
            setError('Failed to generate template.');
        } finally {
            setIsDownloading(false);
        }
    };

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        setError(null);
        setPreviewData([]);

        try {
            const workbook = new ExcelJS.Workbook();
            const arrayBuffer = await file.arrayBuffer();
            await workbook.xlsx.load(arrayBuffer);
            const worksheet = workbook.getWorksheet(1);
            
            const updates: any[] = [];
            worksheet?.eachRow((row, rowNumber) => {
                if (rowNumber === 1) return; // Skip header

                const id = row.getCell(1).value?.toString();
                const name = row.getCell(2).value?.toString();
                const balanceStr = row.getCell(3).value?.toString() || '0';
                const balance = parseFloat(balanceStr);
                const openingDateValue = row.getCell(4).value;
                
                let openingDate = '';
                if (openingDateValue instanceof Date) {
                    openingDate = format(openingDateValue, 'yyyy-MM-dd');
                } else {
                    openingDate = openingDateValue?.toString() || '';
                }

                if (id && !isNaN(balance)) {
                    updates.push({ 
                        id, 
                        name,
                        earned_leave_opening_balance: balance, 
                        earned_leave_opening_date: openingDate || format(new Date(), 'yyyy-MM-dd') 
                    });
                }
            });

            if (updates.length === 0) {
                setError('No valid rows found in the Excel file.');
            } else {
                setPreviewData(updates);
                setToast({ message: 'Excel file parsed successfully!', type: 'success' });
            }
        } catch (err) {
            console.error('Upload error:', err);
            setError('Failed to parse Excel file. Please ensure it is a valid .xlsx file.');
        } finally {
            setIsUploading(false);
            if (event.target) event.target.value = '';
        }
    };

    const handleImport = async () => {
        setIsUploading(true);
        try {
            const formattedUpdates = previewData.map(u => ({
                id: u.id,
                earned_leave_opening_balance: u.earned_leave_opening_balance,
                earned_leave_opening_date: u.earned_leave_opening_date
            }));

            await api.bulkUpdateUserLeaves(formattedUpdates);
            setToast({ message: 'Bulk leave update successful!', type: 'success' });
            setTimeout(() => navigate('/admin/users'), 2000);
        } catch (err) {
            console.error('Import error:', err);
            setError('Failed to update leave balances.');
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className="p-4 md:p-6 lg:p-8">
            {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
            
            <div className="mb-6 flex items-center gap-4">
                <Button variant="outline" size="sm" onClick={() => navigate('/admin/users')}>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to Users
                </Button>
            </div>

            <AdminPageHeader title="Bulk Update Earned Leaves" />

            <div className="mt-8 space-y-8">
                {/* Info Card */}
                <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl flex items-start gap-4">
                    <Info className="h-6 w-6 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div>
                        <h4 className="font-semibold text-blue-900">How to update leave balances in bulk</h4>
                        <p className="text-sm text-blue-800 mt-1">
                            1. Download the current employee template. 2. Update the balance and opening dates in Excel. 3. Upload the modified file to preview and confirm changes.
                        </p>
                    </div>
                </div>

                {/* Step Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Step 1: Download */}
                    <div className="bg-white border border-border rounded-2xl p-8 shadow-sm hover:shadow-md transition-shadow">
                        <div className="bg-emerald-50 w-14 h-14 rounded-2xl flex items-center justify-center mb-6">
                            <Download className="h-8 w-8 text-emerald-600" />
                        </div>
                        <h3 className="text-xl font-bold text-primary-text mb-2">1. Download Template</h3>
                        <p className="text-muted mb-6">
                            Generate a customized Excel spreadsheet containing all active employees and their current leave settings.
                        </p>
                        <Button 
                            variant="primary" 
                            className="w-full h-12 text-lg" 
                            onClick={downloadTemplate}
                            disabled={isDownloading}
                        >
                            {isDownloading ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Download className="h-5 w-5 mr-2" />}
                            Download Current Data
                        </Button>
                    </div>

                    {/* Step 2: Upload */}
                    <div className="bg-white border border-border rounded-2xl p-8 shadow-sm hover:shadow-md transition-shadow">
                        <div className="bg-blue-50 w-14 h-14 rounded-2xl flex items-center justify-center mb-6">
                            <Upload className="h-8 w-8 text-blue-600" />
                        </div>
                        <h3 className="text-xl font-bold text-primary-text mb-2">2. Upload Modified File</h3>
                        <p className="text-muted mb-6">
                            Upload your updated Excel file. The system will automatically detect changes and prepare a preview.
                        </p>
                        <div className="relative">
                            <input
                                type="file"
                                accept=".xlsx"
                                onChange={handleFileUpload}
                                className="absolute inset-0 opacity-0 cursor-pointer"
                                disabled={isUploading}
                            />
                            <Button variant="outline" className="w-full h-12 text-lg pointer-events-none">
                                <Upload className="h-5 w-5 mr-2" />
                                Select Excel File
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Error Box */}
                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 p-6 rounded-2xl flex items-start gap-4 animate-in fade-in zoom-in">
                        <AlertCircle className="h-6 w-6 flex-shrink-0" />
                        <div>
                            <h4 className="font-bold">Error Processing File</h4>
                            <p className="text-sm mt-1">{error}</p>
                        </div>
                    </div>
                )}

                {/* Preview Section */}
                {previewData.length > 0 && (
                    <div className="bg-white border border-border rounded-2xl shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4">
                        <div className="p-6 border-b border-border bg-gray-50/50 flex flex-wrap items-center justify-between gap-4">
                            <div>
                                <h3 className="text-lg font-bold text-primary-text flex items-center gap-2">
                                    <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
                                    Preview Updates ({previewData.length} Records)
                                </h3>
                                <p className="text-sm text-muted mt-1">Please review the detected changes before confirming the update.</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <Button variant="secondary" onClick={() => setPreviewData([])}>Discard</Button>
                                <Button 
                                    onClick={handleImport} 
                                    disabled={isUploading}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-8"
                                >
                                    {isUploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                                    Confirm & Update
                                </Button>
                            </div>
                        </div>
                        
                        <div className="overflow-x-auto max-h-[600px]">
                            <table className="w-full text-left">
                                <thead className="bg-gray-50 sticky top-0 border-b border-border z-10">
                                    <tr>
                                        <th className="px-6 py-4 font-semibold text-sm text-muted uppercase tracking-wider">Employee Name</th>
                                        <th className="px-6 py-4 font-semibold text-sm text-muted uppercase tracking-wider text-center">New Balance (Days)</th>
                                        <th className="px-6 py-4 font-semibold text-sm text-muted uppercase tracking-wider text-right">Opening Date</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {previewData.map((row, idx) => (
                                        <tr key={idx} className="hover:bg-blue-50/30 transition-colors">
                                            <td className="px-6 py-4 font-medium text-primary-text">{row.name}</td>
                                            <td className="px-6 py-4 text-center">
                                                <span className="inline-flex items-center px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 font-bold">
                                                    {row.earned_leave_opening_balance}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right text-muted font-mono">{row.earned_leave_opening_date}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default BulkEarnedLeavePage;
