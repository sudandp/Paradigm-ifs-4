import React, { useState, useEffect } from 'react';
import { useFinanceStore } from '../../store/financeStore';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Toast from '../../components/ui/Toast';
import { exportToCSV } from '../../utils/exportEngine';
import type { OpsPaymentReceipt, PaymentStatus } from '../../types/finance';
import { Plus, Search, IndianRupee, Download, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

const STATUS_COLORS: Record<PaymentStatus, string> = {
  'Pending': 'bg-gray-100 text-gray-800 border-gray-200',
  'Partial': 'bg-blue-100 text-blue-800 border-blue-200',
  'Full': 'bg-green-100 text-green-800 border-green-200',
  'Overdue': 'bg-red-100 text-red-800 border-red-200'
};

const PaymentTracker: React.FC = () => {
  const { receipts, fetchReceipts, createReceipt, isLoading } = useFinanceStore();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<{message: string, type: 'success'|'error'} | null>(null);
  
  const [formData, setFormData] = useState<Partial<OpsPaymentReceipt>>({
    invoiceNumber: '',
    invoiceDate: new Date().toISOString().split('T')[0],
    invoiceBaseAmount: 0,
    invoiceGstAmount: 0,
    amountReceived: 0,
    paymentDate: new Date().toISOString().split('T')[0],
    paymentMode: 'NEFT',
    referenceNumber: '',
    tdsDeducted: 0,
    tdsSection: '194C',
    otherDeductions: 0,
    status: 'Pending',
    entityId: ''
  });

  useEffect(() => {
    fetchReceipts();
  }, []);

  const filteredReceipts = receipts.filter(r => 
    r.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) || 
    r.entityName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.invoiceNumber || !formData.entityId) {
      setToast({ message: 'Invoice Number and Entity are required', type: 'error' });
      return;
    }
    
    setIsSubmitting(true);
    try {
      await createReceipt(formData);
      setToast({ message: 'Payment logged successfully', type: 'success' });
      setShowForm(false);
      // Reset form
      setFormData({
        invoiceNumber: '', invoiceDate: new Date().toISOString().split('T')[0],
        invoiceBaseAmount: 0, invoiceGstAmount: 0, amountReceived: 0,
        paymentDate: new Date().toISOString().split('T')[0], paymentMode: 'NEFT',
        referenceNumber: '', tdsDeducted: 0, tdsSection: '194C', otherDeductions: 0,
        status: 'Pending', entityId: ''
      });
    } catch (err: any) {
      setToast({ message: err.message, type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExport = () => {
    const exportData = filteredReceipts.map(r => ({
      Entity: r.entityName,
      Invoice_No: r.invoiceNumber,
      Invoice_Date: r.invoiceDate,
      Base_Amount: r.invoiceBaseAmount,
      GST_Amount: r.invoiceGstAmount,
      Total_Invoice_Amount: r.invoiceTotalAmount,
      Amount_Received: r.amountReceived,
      TDS_Deducted: r.tdsDeducted,
      TDS_Section: r.tdsSection,
      Payment_Mode: r.paymentMode,
      Ref_No: r.referenceNumber,
      Status: r.status
    }));
    exportToCSV(exportData, 'Payment_Receipts_Tally_Export');
  };

  // Auto-calculate GST (18%) and TDS (2% default for 194C) when base changes
  const handleBaseChange = (val: string) => {
    const base = Number(val) || 0;
    const is194C = formData.tdsSection === '194C';
    const is194J = formData.tdsSection === '194J';
    
    let tdsPercent = 0;
    if (is194C) tdsPercent = 2;
    if (is194J) tdsPercent = 10;

    setFormData(prev => ({
      ...prev,
      invoiceBaseAmount: base,
      invoiceGstAmount: base * 0.18,
      tdsDeducted: base * (tdsPercent / 100)
    }));
  };

  return (
    <div className="space-y-6">
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
      
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-primary-text">Payment Tracker (TDS/GST)</h1>
          <p className="text-sm text-muted">Log invoice realizations and statutory deductions for Tally</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleExport} variant="outline" className="gap-2 border-accent text-accent hover:bg-accent/10">
            <Download className="w-4 h-4" /> Export for Tally
          </Button>
          <Button onClick={() => setShowForm(true)} variant="primary" className="gap-2">
            <Plus className="w-4 h-4" /> Log Payment
          </Button>
        </div>
      </div>

      {showForm && (
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm animate-fade-in-down">
          <h2 className="text-lg font-bold mb-4 border-b border-border pb-2">Log New Invoice / Payment</h2>
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Invoice Section */}
            <div className="bg-page p-4 rounded-lg border border-border space-y-4">
              <h3 className="text-sm font-bold text-primary-text flex items-center gap-2">
                <FileText className="w-4 h-4" /> Invoice Details
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Input label="Entity ID *" value={formData.entityId} onChange={e => setFormData(p => ({ ...p, entityId: e.target.value }))} className="md:col-span-2" />
                <Input label="Invoice Number *" value={formData.invoiceNumber} onChange={e => setFormData(p => ({ ...p, invoiceNumber: e.target.value }))} />
                <Input label="Invoice Date" type="date" value={formData.invoiceDate} onChange={e => setFormData(p => ({ ...p, invoiceDate: e.target.value }))} />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <Input label="Base Amount (₹) *" type="number" value={formData.invoiceBaseAmount || ''} onChange={e => handleBaseChange(e.target.value)} />
                <Input label="GST @ 18% (₹)" type="number" value={formData.invoiceGstAmount || ''} onChange={e => setFormData(p => ({ ...p, invoiceGstAmount: Number(e.target.value) }))} />
                <div className="md:col-span-2 p-2 bg-accent/5 rounded-lg border border-accent/20 flex items-center justify-between">
                  <span className="text-sm font-bold text-muted">Total Invoice Value:</span>
                  <span className="text-lg font-bold text-accent">₹ {((formData.invoiceBaseAmount || 0) + (formData.invoiceGstAmount || 0)).toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>

            {/* Payment Section */}
            <div className="bg-page p-4 rounded-lg border border-border space-y-4">
              <h3 className="text-sm font-bold text-primary-text flex items-center gap-2">
                <IndianRupee className="w-4 h-4" /> Realization Details
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Input label="Amount Received (₹)" type="number" value={formData.amountReceived || ''} onChange={e => setFormData(p => ({ ...p, amountReceived: Number(e.target.value) }))} />
                <Input label="Payment Date" type="date" value={formData.paymentDate} onChange={e => setFormData(p => ({ ...p, paymentDate: e.target.value }))} />
                
                <div>
                  <label className="block text-xs font-semibold text-muted mb-1.5">Payment Mode</label>
                  <select className="form-input" value={formData.paymentMode} onChange={e => setFormData(p => ({ ...p, paymentMode: e.target.value as any }))}>
                    {['NEFT', 'RTGS', 'IMPS', 'UPI', 'Cheque', 'Cash'].map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                
                <Input label="Ref / UTR Number" value={formData.referenceNumber || ''} onChange={e => setFormData(p => ({ ...p, referenceNumber: e.target.value }))} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2 border-t border-border">
                <div>
                  <label className="block text-xs font-semibold text-muted mb-1.5">TDS Section</label>
                  <select className="form-input" value={formData.tdsSection} onChange={e => {
                    const sec = e.target.value;
                    const base = formData.invoiceBaseAmount || 0;
                    setFormData(p => ({ 
                      ...p, 
                      tdsSection: sec,
                      tdsDeducted: sec === '194C' ? base * 0.02 : sec === '194J' ? base * 0.1 : 0
                    }));
                  }}>
                    <option value="194C">194C (Contractor - 2%)</option>
                    <option value="194J">194J (Professional - 10%)</option>
                    <option value="None">None (0%)</option>
                  </select>
                </div>
                <Input label="TDS Deducted (₹)" type="number" value={formData.tdsDeducted || ''} onChange={e => setFormData(p => ({ ...p, tdsDeducted: Number(e.target.value) }))} />
                <Input label="Other Deductions (₹)" type="number" value={formData.otherDeductions || ''} onChange={e => setFormData(p => ({ ...p, otherDeductions: Number(e.target.value) }))} />
              </div>
            </div>
            
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button type="submit" variant="primary" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Save Entry
              </Button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden flex flex-col h-[calc(100vh-220px)] min-h-[500px]">
        {/* Toolbar */}
        <div className="p-4 border-b border-border flex gap-4 justify-between items-center bg-accent/5">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
            <input 
              type="text" 
              placeholder="Search by invoice or entity..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-page border border-border rounded-lg text-sm"
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-auto p-0">
          {isLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="w-8 h-8 animate-spin text-accent" /></div>
          ) : (
            <table className="w-full text-left text-sm border-collapse whitespace-nowrap">
              <thead className="bg-page border-b border-border text-muted sticky top-0 z-10">
                <tr>
                  <th className="p-4 font-semibold">Invoice & Entity</th>
                  <th className="p-4 font-semibold text-right">Invoice Total</th>
                  <th className="p-4 font-semibold text-right">Received</th>
                  <th className="p-4 font-semibold text-right text-red-600">TDS</th>
                  <th className="p-4 font-semibold text-right">Outstanding</th>
                  <th className="p-4 font-semibold text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredReceipts.map(receipt => {
                  const invTotal = receipt.invoiceTotalAmount || 0;
                  const totalRealized = (receipt.amountReceived || 0) + (receipt.tdsDeducted || 0) + (receipt.otherDeductions || 0);
                  const outstanding = invTotal - totalRealized;
                  
                  return (
                    <tr key={receipt.id} className="hover:bg-accent/5 transition-colors">
                      <td className="p-4">
                        <div className="font-bold text-primary-text text-base">{receipt.invoiceNumber}</div>
                        <div className="text-xs text-muted mt-0.5">{receipt.entityName || 'Unknown Entity'}</div>
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-accent/70 mt-1">
                          {receipt.invoiceDate ? new Date(receipt.invoiceDate).toLocaleDateString('en-IN') : '-'}
                        </div>
                      </td>
                      <td className="p-4 text-right font-bold">
                        ₹ {invTotal.toLocaleString('en-IN')}
                        <div className="text-[10px] text-muted font-normal mt-0.5">Base: ₹{(receipt.invoiceBaseAmount||0).toLocaleString('en-IN')}</div>
                      </td>
                      <td className="p-4 text-right">
                        <div className="font-bold text-green-600">₹ {(receipt.amountReceived||0).toLocaleString('en-IN')}</div>
                        <div className="text-[10px] text-muted font-semibold mt-0.5">{receipt.paymentMode} {receipt.referenceNumber ? `(${receipt.referenceNumber})` : ''}</div>
                      </td>
                      <td className="p-4 text-right text-red-600 font-semibold">
                        ₹ {(receipt.tdsDeducted||0).toLocaleString('en-IN')}
                        <div className="text-[10px] opacity-70 mt-0.5">{receipt.tdsSection}</div>
                      </td>
                      <td className="p-4 text-right">
                        <span className={`font-bold ${outstanding > 0 ? 'text-orange-500' : 'text-gray-400'}`}>
                          ₹ {outstanding.toLocaleString('en-IN')}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold border ${STATUS_COLORS[receipt.status]}`}>
                          {receipt.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {filteredReceipts.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-muted">No payments found. Create one to start tracking.</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

// Also add a local FileText icon component to fix import mismatch
const FileText = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

export default PaymentTracker;
