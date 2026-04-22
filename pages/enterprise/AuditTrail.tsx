import React, { useState, useEffect } from 'react';
import { useEnterpriseStore } from '../../store/enterpriseStore';
import { ShieldCheck, Search, Filter, History, ChevronDown, ChevronRight, Loader2, ArrowRight } from 'lucide-react';
import type { SystemAuditLog } from '../../types/enterprise';

const AuditTrail: React.FC = () => {
  const { auditLogs, fetchAuditLogs, isLoading } = useEnterpriseStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [moduleFilter, setModuleFilter] = useState<string>('All');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  useEffect(() => {
    fetchAuditLogs();
  }, []);

  const filteredLogs = auditLogs.filter(log => 
    (moduleFilter === 'All' || log.moduleName === moduleFilter) &&
    (log.recordId.toLowerCase().includes(searchTerm.toLowerCase()) || 
     log.tableName.toLowerCase().includes(searchTerm.toLowerCase()) ||
     log.userName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
     log.actionType.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const getActionColor = (action: string) => {
    switch(action) {
      case 'INSERT': return 'bg-green-100 text-green-800 border-green-200';
      case 'UPDATE': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'DELETE': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const renderJsonDiff = (oldData: any, newData: any) => {
    if (!oldData && !newData) return <div className="text-muted italic text-xs">No payload recorded.</div>;
    
    // Very basic structural diff visualizer
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-3 bg-accent/5 p-4 rounded-lg border border-accent/10">
        <div>
          <h4 className="text-xs font-bold text-red-600 uppercase tracking-wider mb-2 flex items-center gap-1">Old State <ArrowRight className="w-3 h-3"/></h4>
          <pre className="text-[10px] bg-page border border-border p-3 rounded-md overflow-x-auto text-muted">
            {oldData ? JSON.stringify(oldData, null, 2) : 'null'}
          </pre>
        </div>
        <div>
          <h4 className="text-xs font-bold text-green-600 uppercase tracking-wider mb-2 flex items-center gap-1">New State <ArrowRight className="w-3 h-3"/></h4>
          <pre className="text-[10px] bg-page border border-border p-3 rounded-md overflow-x-auto text-primary-text font-medium shadow-inner">
            {newData ? JSON.stringify(newData, null, 2) : 'null'}
          </pre>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-primary-text flex items-center gap-2">
            <History className="w-6 h-6 text-accent" /> System Audit Trail
          </h1>
          <p className="text-sm text-muted">Immutable ledger of all system modifications</p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden flex flex-col h-[calc(100vh-180px)] min-h-[500px]">
        {/* Toolbar */}
        <div className="p-4 border-b border-border flex flex-col sm:flex-row gap-4 justify-between items-center bg-accent/5">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
            <input 
              type="text" 
              placeholder="Search by ID, Table, User, or Action..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-page border border-border rounded-lg text-sm"
            />
          </div>
          <div className="flex gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
            {['All', 'CRM', 'Operations', 'Finance', 'System'].map(mod => (
              <button
                key={mod}
                onClick={() => setModuleFilter(mod)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                  moduleFilter === mod ? 'bg-accent text-white' : 'bg-page border border-border text-muted hover:text-primary-text'
                }`}
              >
                {mod}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-auto p-0">
          {isLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="w-8 h-8 animate-spin text-accent" /></div>
          ) : (
            <table className="w-full text-left text-sm border-collapse">
              <thead className="bg-page border-b border-border text-muted sticky top-0 z-10">
                <tr>
                  <th className="p-4 font-semibold w-10"></th>
                  <th className="p-4 font-semibold">Timestamp</th>
                  <th className="p-4 font-semibold">User</th>
                  <th className="p-4 font-semibold">Module & Table</th>
                  <th className="p-4 font-semibold">Action</th>
                  <th className="p-4 font-semibold">Record ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredLogs.map(log => {
                  const isExpanded = expandedRow === log.id;
                  
                  return (
                    <React.Fragment key={log.id}>
                      <tr 
                        className={`hover:bg-accent/5 transition-colors cursor-pointer ${isExpanded ? 'bg-accent/5' : ''}`}
                        onClick={() => setExpandedRow(isExpanded ? null : log.id)}
                      >
                        <td className="p-4 text-muted">
                          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </td>
                        <td className="p-4 text-xs font-mono text-muted whitespace-nowrap">
                          {new Date(log.createdAt).toLocaleString('en-IN')}
                        </td>
                        <td className="p-4">
                          <div className="font-semibold text-primary-text">{log.userName || 'System'}</div>
                          <div className="text-[10px] text-muted">{log.userEmail || '-'}</div>
                        </td>
                        <td className="p-4">
                          <div className="font-bold text-primary-text">{log.tableName}</div>
                          <div className="text-[10px] uppercase tracking-wider text-accent font-semibold">{log.moduleName}</div>
                        </td>
                        <td className="p-4">
                          <span className={`px-2 py-1 rounded-md text-[10px] font-bold border ${getActionColor(log.actionType)}`}>
                            {log.actionType}
                          </span>
                        </td>
                        <td className="p-4 text-xs font-mono text-muted">
                          {log.recordId}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan={6} className="p-0 border-b border-border">
                            <div className="px-12 py-4 bg-page/50 border-l-4 border-accent">
                              {renderJsonDiff(log.oldData, log.newData)}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
                {filteredLogs.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-muted">No audit logs found matching your criteria.</td>
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

export default AuditTrail;
