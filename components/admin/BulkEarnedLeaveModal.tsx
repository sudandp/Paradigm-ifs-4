import React, { useState } from 'react';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { api } from '../../services/api';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { Download, Upload, AlertCircle, CheckCircle2, Loader2, FileSpreadsheet } from 'lucide-react';
import { format } from 'date-fns';

interface BulkEarnedLeaveModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

const BulkEarnedLeaveModal: React.FC<BulkEarnedLeaveModalProps> = ({ isOpen, onClose, onSuccess }) => {
    const [isDownloading, setIsDownloading] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [previewData, setPreviewData] = useState<any[]>([]);
    const [error, setError] = useState<string | null>(null);

    const downloadTemplate = async () => {
        setIsDownloading(true);
        try {
            const users = await api.getUsers(); // Get all users
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Leave Balances');

            worksheet.columns = [
                { header: 'User ID', key: 'id', width: 40 },
                { header: 'Employee Name', key: 'name', width: 30 },
                { header: 'Earned Leave Balance', key: 'elBalance', width: 20 },
                { header: 'EL Opening Date (YYYY-MM-DD)', key: 'elDate', width: 25 },
                { header: 'Sick Leave Balance', key: 'slBalance', width: 20 },
                { header: 'SL Opening Date (YYYY-MM-DD)', key: 'slDate', width: 25 },
                { header: 'Comp Off Balance', key: 'coBalance', width: 20 },
                { header: 'CO Opening Date (YYYY-MM-DD)', key: 'coDate', width: 25 },
                { header: 'Floating Leave Balance', key: 'flBalance', width: 20 },
                { header: 'FL Opening Date (YYYY-MM-DD)', key: 'flDate', width: 25 },
            ];

            // Add sample instructions or styling
            worksheet.getRow(1).font = { bold: true };
            worksheet.getRow(1).fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFE0E0E0' }
            };

            users.forEach((u: any) => {
                const today = format(new Date(), 'yyyy-MM-dd');
                worksheet.addRow({
                    id: u.id,
                    name: u.name,
                    elBalance: u.earnedLeaveOpeningBalance || 0,
                    elDate: u.earnedLeaveOpeningDate || today,
                    slBalance: u.sickLeaveOpeningBalance || 0,
                    slDate: u.sickLeaveOpeningDate || today,
                    coBalance: u.compOffOpeningBalance || 0,
                    coDate: u.compOffOpeningDate || today,
                    flBalance: u.floatingLeaveOpeningBalance || 0,
                    flDate: u.floatingLeaveOpeningDate || today
                });
            });

            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            saveAs(blob, `Earned_Leaves_Update_Template_${format(new Date(), 'yyyyMMdd')}.xlsx`);
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
                
                const elBalance = parseFloat(row.getCell(3).value?.toString() || '0');
                const elDate = row.getCell(4).value?.toString();
                
                const slBalance = parseFloat(row.getCell(5).value?.toString() || '0');
                const slDate = row.getCell(6).value?.toString();
                
                const coBalance = parseFloat(row.getCell(7).value?.toString() || '0');
                const coDate = row.getCell(8).value?.toString();
                
                const flBalance = parseFloat(row.getCell(9).value?.toString() || '0');
                const flDate = row.getCell(10).value?.toString();

                if (id) {
                    updates.push({ 
                        id, 
                        name,
                        earnedLeaveOpeningBalance: elBalance, 
                        earnedLeaveOpeningDate: elDate,
                        sickLeaveOpeningBalance: slBalance,
                        sickLeaveOpeningDate: slDate,
                        compOffOpeningBalance: coBalance,
                        compOffOpeningDate: coDate,
                        floatingLeaveOpeningBalance: flBalance,
                        floatingLeaveOpeningDate: flDate
                    });
                }
            });

            if (updates.length === 0) {
                setError('No valid rows found in the Excel file.');
            } else {
                setPreviewData(updates);
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
                earnedLeaveOpeningBalance: u.earnedLeaveOpeningBalance,
                earnedLeaveOpeningDate: u.earnedLeaveOpeningDate,
                sickLeaveOpeningBalance: u.sickLeaveOpeningBalance,
                sickLeaveOpeningDate: u.sickLeaveOpeningDate,
                compOffOpeningBalance: u.compOffOpeningBalance,
                compOffOpeningDate: u.compOffOpeningDate,
                floatingLeaveOpeningBalance: u.floatingLeaveOpeningBalance,
                floatingLeaveOpeningDate: u.floatingLeaveOpeningDate
            }));

            await api.bulkUpdateUserLeaves(formattedUpdates);
            onSuccess();
            onClose();
        } catch (err) {
            console.error('Import error:', err);
            setError('Failed to update leave balances.');
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Bulk Update Leave Balances"
            maxWidth="md:max-w-4xl"
            hideFooter
        >
            <div className="space-y-6 p-1">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="border border-dashed border-border rounded-xl p-6 text-center hover:border-emerald-500 transition-colors group">
                        <div className="bg-emerald-50 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-emerald-100 transition-colors">
                            <Download className="h-6 w-6 text-emerald-600" />
                        </div>
                        <h4 className="font-semibold text-primary-text mb-2">1. Download Template</h4>
                        <p className="text-xs text-muted mb-4">Get an Excel sheet pre-filled with current employee data.</p>
                        <Button 
                            variant="outline" 
                            className="w-full" 
                            onClick={downloadTemplate}
                            disabled={isDownloading}
                        >
                            {isDownloading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
                            Download Excel
                        </Button>
                    </div>

                    <div className="border border-dashed border-border rounded-xl p-6 text-center hover:border-blue-500 transition-colors group">
                        <div className="bg-blue-50 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-blue-100 transition-colors">
                            <Upload className="h-6 w-6 text-blue-600" />
                        </div>
                        <h4 className="font-semibold text-primary-text mb-2">2. Upload & Preview</h4>
                        <p className="text-xs text-muted mb-4">Select your modified Excel file to preview changes.</p>
                        <div className="relative">
                            <input
                                type="file"
                                accept=".xlsx"
                                onChange={handleFileUpload}
                                className="absolute inset-0 opacity-0 cursor-pointer"
                                disabled={isUploading}
                            />
                            <Button variant="outline" className="w-full pointer-events-none">
                                <Upload className="h-4 w-4 mr-2" />
                                Select File
                            </Button>
                        </div>
                    </div>
                </div>

                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
                        <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                        <p className="text-sm font-medium">{error}</p>
                    </div>
                )}

                {previewData.length > 0 && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                        <div className="flex items-center justify-between border-b border-border pb-2">
                            <h5 className="font-bold text-sm uppercase tracking-wider text-muted">Preview Updates ({previewData.length} Employees)</h5>
                            <div className="flex items-center text-emerald-600 text-xs font-semibold">
                                <CheckCircle2 className="h-4 w-4 mr-1" />
                                Ready to Import
                            </div>
                        </div>
                        
                        <div className="max-h-[400px] overflow-auto rounded-lg border border-border">
                            <table className="min-w-full text-[11px]">
                                <thead className="bg-muted/30 sticky top-0">
                                    <tr className="divide-x divide-border">
                                        <th className="px-3 py-2 text-left font-bold bg-muted/50">Employee</th>
                                        <th className="px-3 py-2 text-center font-bold bg-emerald-50 text-emerald-800" title="Earned Leave">EL Bal</th>
                                        <th className="px-3 py-2 text-center font-bold bg-blue-50 text-blue-800" title="Sick Leave">SL Bal</th>
                                        <th className="px-3 py-2 text-center font-bold bg-amber-50 text-amber-800" title="Comp Off">CO Bal</th>
                                        <th className="px-3 py-2 text-center font-bold bg-purple-50 text-purple-800" title="Floating Holiday">FH Bal</th>
                                        <th className="px-3 py-2 text-right font-bold text-muted">Updates</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {previewData.map((row, idx) => (
                                        <tr key={idx} className="hover:bg-muted/5 transition-colors divide-x divide-border">
                                            <td className="px-3 py-2 font-medium truncate max-w-[150px]">{row.name}</td>
                                            <td className="px-3 py-2 text-center font-bold bg-emerald-50/30 text-emerald-700">{row.earnedLeaveOpeningBalance}</td>
                                            <td className="px-3 py-2 text-center font-bold bg-blue-50/30 text-blue-700">{row.sickLeaveOpeningBalance}</td>
                                            <td className="px-3 py-2 text-center font-bold bg-amber-50/30 text-amber-700">{row.compOffOpeningBalance}</td>
                                            <td className="px-3 py-2 text-center font-bold bg-purple-50/30 text-purple-700">{row.floatingLeaveOpeningBalance}</td>
                                            <td className="px-3 py-2 text-right text-[10px] text-muted italic">
                                                All types
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="flex justify-end gap-3 pt-4 border-t border-border">
                            <Button variant="secondary" onClick={() => setPreviewData([])}>Cancel</Button>
                            <Button 
                                onClick={handleImport} 
                                disabled={isUploading}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white min-w-[140px]"
                            >
                                {isUploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileSpreadsheet className="h-4 w-4 mr-2" />}
                                Confirm Import
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
};

export default BulkEarnedLeaveModal;
