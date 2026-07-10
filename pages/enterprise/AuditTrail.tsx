import React, { useState, useEffect } from 'react';
import { useEnterpriseStore } from '../../store/enterpriseStore';
import { ShieldCheck, Search, Filter, History, ChevronDown, ChevronRight, Loader2, ArrowRight } from 'lucide-react';
import type { SystemAuditLog } from '../../types/enterprise';
import { useMediaQuery } from '../../hooks/useMediaQuery';

import { useAuthStore } from '../../store/authStore';
import { isAdmin } from '../../utils/auth';
import { Navigate } from 'react-router-dom';

const AuditTrail: React.FC = () => {
  const { user } = useAuthStore();

  if (!user || !isAdmin(user.role)) {
    return <Navigate to="/" replace />;
  }

  const { auditLogs, fetchAuditLogs, isLoading } = useEnterpriseStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [moduleFilter, setModuleFilter] = useState<string>('All');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const isMobile = useMediaQuery('(max-width: 767px)');

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
    if (isMobile) {
      switch(action) {
        case 'INSERT': return 'bg-green-900/40 text-green-400 border-green-800';
        case 'UPDATE': return 'bg-blue-900/40 text-blue-400 border-blue-800';
        case 'DELETE': return 'bg-red-900/40 text-red-400 border-red-800';
        default: return 'bg-gray-800/40 text-gray-300 border-gray-700';
      }
    }
    switch(action) {
      case 'INSERT': return 'bg-green-100 text-green-800 border-green-200';
      case 'UPDATE': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'DELETE': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const renderJsonDiff = (oldData: any, newData: any) => {
    if (!oldData && !newData) return <div className={`italic text-xs ${isMobile ? 'text-gray-500' : 'text-muted'}`}>No payload recorded.</div>;
    
    return (
      <div className={`grid grid-cols-1 lg:grid-cols-2 gap-4 mt-3 p-4 rounded-lg border ${isMobile ? 'bg-[#041b0f] border-[#1d422f]' : 'bg-accent/5 border-accent/10'}`}>
        <div>
          <h4 className="text-xs font-bold text-red-500 uppercase tracking-wider mb-2 flex items-center gap-1">Old State <ArrowRight className="w-3 h-3"/></h4>
          <pre className={`text-[10px] p-3 rounded-md overflow-x-auto ${isMobile ? 'bg-black/50 border border-red-900/50 text-gray-300' : 'bg-page border border-border text-muted'}`}>
            {oldData ? JSON.stringify(oldData, null, 2) : 'null'}
          </pre>
        </div>
        <div>
          <h4 className="text-xs font-bold text-green-500 uppercase tracking-wider mb-2 flex items-center gap-1">New State <ArrowRight className="w-3 h-3"/></h4>
          <pre className={`text-[10px] p-3 rounded-md overflow-x-auto font-medium shadow-inner ${isMobile ? 'bg-[#041b0f] border border-green-900/50 text-[#22c55e]' : 'bg-page border border-border text-primary-text'}`}>
            {newData ? JSON.stringify(newData, null, 2) : 'null'}
          </pre>
        </div>
      </div>
    );
  };

  return (
    <div className={isMobile ? "space-y-6 bg-[#041b0f] min-h-screen text-white -mx-4 -mt-8 pt-8 px-4" : "space-y-6"}>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className={`text-2xl font-bold flex items-center gap-2 ${isMobile ? 'text-white' : 'text-primary-text'}`}>
            <History className={`w-6 h-6 ${isMobile ? 'text-[#22c55e]' : 'text-accent'}`} /> System Audit Trail
          </h1>
          <p className={`text-sm ${isMobile ? 'text-gray-400' : 'text-muted'}`}>Immutable ledger of all system modifications</p>
        </div>
      </div>

      <div className={isMobile ? "flex flex-col min-h-[500px]" : "bg-card border border-border rounded-xl shadow-sm overflow-hidden flex flex-col h-[calc(100vh-180px)] min-h-[500px]"}>
        {/* Toolbar */}
        <div className={`p-4 flex flex-col sm:flex-row gap-4 justify-between items-center ${isMobile ? 'bg-transparent px-0 pb-2' : 'border-b border-border bg-accent/5'}`}>
          <div className="relative w-full sm:w-96">
            <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isMobile ? 'text-gray-500' : 'text-muted'}`} />
            <input 
              type="text" 
              placeholder="Search by ID, Table, User, or Action..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className={isMobile ? "w-full pl-9 pr-4 py-2 bg-[#041b0f] border border-[#1d422f] rounded-lg text-sm text-white focus:outline-none focus:border-[#22c55e]" : "w-full pl-9 pr-4 py-2 bg-page border border-border rounded-lg text-sm"}
            />
          </div>
          <div className="flex gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0 scrollbar-hide">
            {['All', 'CRM', 'Operations', 'Finance', 'System'].map(mod => (
              <button
                key={mod}
                onClick={() => setModuleFilter(mod)}
                className={isMobile 
                  ? `px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${moduleFilter === mod ? 'bg-[#22c55e] text-[#041b0f]' : 'bg-[#041b0f] border border-[#1d422f] text-gray-300'}`
                  : `px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${moduleFilter === mod ? 'bg-accent text-white' : 'bg-page border border-border text-muted hover:text-primary-text'}`
                }
              >
                {mod}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        <div className={`flex-1 overflow-auto ${isMobile ? 'p-0 pt-2 pb-8' : 'p-0'}`}>
          {isLoading ? (
            <div className="flex justify-center py-10"><Loader2 className={`w-8 h-8 animate-spin ${isMobile ? 'text-[#22c55e]' : 'text-accent'}`} /></div>
          ) : isMobile ? (
             <div className="flex flex-col gap-3">
                {filteredLogs.map(log => {
                   const isExpanded = expandedRow === log.id;
                   return (
                     <div key={log.id} className="bg-black/30 backdrop-blur-md border border-[#1d422f] rounded-2xl overflow-hidden flex flex-col transition-all">
                       <div className="p-4 flex items-center justify-between active:scale-[0.98] cursor-pointer" onClick={() => setExpandedRow(isExpanded ? null : log.id)}>
                         <div>
                            <div className="flex items-center gap-2 mb-1">
                               <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getActionColor(log.actionType)}`}>{log.actionType}</span>
                               <span className="text-xs text-gray-400 font-mono">{new Date(log.createdAt).toLocaleString('en-IN')}</span>
                            </div>
                            <div className="font-bold text-white text-sm">{log.tableName}</div>
                            <div className="text-xs text-[#22c55e]">{log.userName || 'System'} <span className="text-gray-500">• {log.moduleName}</span></div>
                         </div>
                         <div className="h-8 w-8 rounded-full bg-[#1d422f]/50 flex items-center justify-center flex-shrink-0">
                           {isExpanded ? <ChevronDown className="h-4 w-4 text-[#22c55e]" /> : <ChevronRight className="h-4 w-4 text-[#22c55e]" />}
                         </div>
                       </div>
                       {isExpanded && (
                          <div className="p-4 border-t border-[#1d422f] bg-black/40">
                             {renderJsonDiff(log.oldData, log.newData)}
                             <div className="mt-3 text-[10px] text-gray-500 font-mono break-all">ID: {log.recordId}</div>
                          </div>
                       )}
                     </div>
                   );
                })}
                {filteredLogs.length === 0 && (
                   <div className="text-center py-10 bg-black/20 rounded-2xl border border-[#1d422f]">
                       <p className="text-sm text-gray-400">No audit logs found matching your criteria.</p>
                   </div>
                )}
             </div>
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
