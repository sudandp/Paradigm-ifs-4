import React, { useState, useEffect } from 'react';
import { useFinanceStore } from '../../store/financeStore';
import { exportToCSV } from '../../utils/exportEngine';
import Button from '../../components/ui/Button';
import { Download, TrendingUp, IndianRupee, PieChart, ShieldAlert, Loader2 } from 'lucide-react';

const ProfitabilityDashboard: React.FC = () => {
  const { profitabilityMetrics, fetchProfitabilityStats, isLoading } = useFinanceStore();
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchProfitabilityStats();
  }, []);

  const filteredMetrics = profitabilityMetrics.filter(m => 
    m.entityName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleExport = () => {
    const exportData = filteredMetrics.map(m => ({
      Entity_Name: m.entityName,
      Total_AMC_Value: m.totalContractValue,
      Total_Invoiced: m.totalInvoiced,
      Total_Received: m.totalReceived,
      Total_TDS_Deducted: m.totalTdsDeducted,
      Outstanding_Amount: m.totalOutstanding,
      Est_Profit_Margin_Percent: m.profitMarginPercent
    }));
    exportToCSV(exportData, 'Profitability_Report');
  };

  // Aggregate stats
  const totalRevenue = filteredMetrics.reduce((sum, m) => sum + m.totalContractValue, 0);
  const totalInvoiced = filteredMetrics.reduce((sum, m) => sum + m.totalInvoiced, 0);
  const totalOutstanding = filteredMetrics.reduce((sum, m) => sum + m.totalOutstanding, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-primary-text">Profitability Dashboard</h1>
          <p className="text-sm text-muted">Track property margins, revenue vs. costs, and outstanding invoices</p>
        </div>
        <Button onClick={handleExport} variant="outline" className="gap-2 border-accent text-accent hover:bg-accent/10">
          <Download className="w-4 h-4" /> Export Report
        </Button>
      </div>

      {/* Top Aggregate Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-xl p-5 flex items-center gap-4 shadow-sm">
          <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 shrink-0">
            <PieChart className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-semibold text-muted uppercase tracking-wider mb-1">Total AMC Value</div>
            <div className="text-2xl font-bold text-primary-text">₹ {(totalRevenue).toLocaleString('en-IN')}</div>
          </div>
        </div>
        
        <div className="bg-card border border-border rounded-xl p-5 flex items-center gap-4 shadow-sm">
          <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center text-green-600 shrink-0">
            <IndianRupee className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-semibold text-muted uppercase tracking-wider mb-1">Total Invoiced</div>
            <div className="text-2xl font-bold text-primary-text">₹ {(totalInvoiced).toLocaleString('en-IN')}</div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-5 flex items-center gap-4 shadow-sm">
          <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 shrink-0">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-semibold text-muted uppercase tracking-wider mb-1">Outstanding Balance</div>
            <div className="text-2xl font-bold text-orange-600">₹ {(totalOutstanding).toLocaleString('en-IN')}</div>
          </div>
        </div>
      </div>

      {/* Detail Table */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden flex flex-col min-h-[400px]">
        <div className="p-4 border-b border-border bg-accent/5">
          <input 
            type="text" 
            placeholder="Search by Property/Entity name..." 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full max-w-md px-4 py-2 bg-page border border-border rounded-lg text-sm"
          />
        </div>

        <div className="flex-1 overflow-x-auto p-0">
          {isLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="w-8 h-8 animate-spin text-accent" /></div>
          ) : (
            <table className="w-full text-left text-sm border-collapse whitespace-nowrap">
              <thead className="bg-page border-b border-border text-muted">
                <tr>
                  <th className="p-4 font-semibold">Entity Name</th>
                  <th className="p-4 font-semibold text-right">AMC Value</th>
                  <th className="p-4 font-semibold text-right">Invoiced Total</th>
                  <th className="p-4 font-semibold text-right">Total Received</th>
                  <th className="p-4 font-semibold text-right">TDS Held</th>
                  <th className="p-4 font-semibold text-right text-orange-500">Outstanding</th>
                  <th className="p-4 font-semibold text-right text-green-600">Est. Margin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredMetrics.map(metric => (
                  <tr key={metric.entityId} className="hover:bg-accent/5 transition-colors">
                    <td className="p-4 font-bold text-primary-text">{metric.entityName}</td>
                    <td className="p-4 text-right">₹ {metric.totalContractValue.toLocaleString('en-IN')}</td>
                    <td className="p-4 text-right">₹ {metric.totalInvoiced.toLocaleString('en-IN')}</td>
                    <td className="p-4 text-right text-green-600 font-semibold">₹ {metric.totalReceived.toLocaleString('en-IN')}</td>
                    <td className="p-4 text-right text-muted">₹ {metric.totalTdsDeducted.toLocaleString('en-IN')}</td>
                    <td className="p-4 text-right font-bold text-orange-500">₹ {metric.totalOutstanding.toLocaleString('en-IN')}</td>
                    <td className="p-4 text-right font-bold text-green-600">
                      <div className="flex items-center justify-end gap-1">
                        <TrendingUp className="w-3.5 h-3.5" />
                        {metric.profitMarginPercent}%
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredMetrics.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-muted">No profitability data found. Ensure active contracts and payment receipts exist.</td>
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

export default ProfitabilityDashboard;
