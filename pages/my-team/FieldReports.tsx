import React, { useState, useEffect, useRef } from 'react';
import Modal from '../../components/ui/Modal';
import { api } from '../../services/api';
import type { AttendanceEvent, User, FieldReport, ChecklistTemplate } from '../../types';
import { useAuthStore } from '../../store/authStore';
import { FileText, Download, Calendar, User as UserIcon, MapPin, Building, Briefcase, ChevronDown, ChevronUp, Image as ImageIcon, ClipboardCheck, Send, FilterX, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import Button from '../../components/ui/Button';
import Pagination from '../../components/ui/Pagination';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import { pdf } from '@react-pdf/renderer';
import { FieldReportDocument } from '../attendance/PDFReports';
import { useDevice } from '../../hooks/useDevice';
import LoadingScreen from '../../components/ui/LoadingScreen';


// --- PDF Preview Component ---
const PdfPreviewModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    report: (FieldReport & { userName: string }) | null;
    template: ChecklistTemplate | undefined;
}> = ({ isOpen, onClose, report, template }) => {
    const { user } = useAuthStore();
    const [isGenerating, setIsGenerating] = useState(false);
    const [isSending, setIsSending] = useState(false);

    const generatePdfBlob = async (): Promise<Blob | null> => {
        if (!report) return null;
        
        try {
            const doc = <FieldReportDocument report={report} template={template} />;
            const blob = await pdf(doc).toBlob();
            return blob;
        } catch (error) {
            console.error('Failed to generate PDF blob', error);
            return null;
        }
    };

    const handleDownload = async () => {
        if (!report) return;
        setIsGenerating(true);
        try {
            const blob = await generatePdfBlob();
            if (blob) {
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `FieldReport_${report.siteName.replace(/\s+/g, '_')}_${format(new Date(report.createdAt), 'yyyyMMdd')}.pdf`;
                link.click();
                URL.revokeObjectURL(url);
            }
            onClose();
        } catch (err) {
            console.error("PDF generation failed:", err);
            alert("Failed to generate PDF.");
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSendToManager = async () => {
        if (!report) return;
        if (!user?.reportingManagerId) {
            alert("You do not have a reporting manager assigned.");
            return;
        }

        setIsSending(true);
        try {
            const pdfBlob = await generatePdfBlob();
            if (!pdfBlob) throw new Error("Failed to generate PDF blob");

             const manager = await api.getUserById(user.reportingManagerId);
             const managerName = manager?.name || "Manager";

            await api.sendFieldReport(
                report.id, 
                pdfBlob, 
                user.reportingManagerId, 
                managerName,
                report.userName
            );

            alert(`Report sent successfully to ${managerName}!`);
            onClose(); // Optional: close            }
        } catch (err) {
            console.error("Report sending failed:", err);
            alert("Failed to send report.");
        } finally {
            setIsSending(false);
        }
    };

    if (!report) return null;



    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            onConfirm={handleDownload}
            title="Report Preview"
            confirmButtonText={isGenerating ? "Generating..." : "Download PDF"}
            confirmButtonVariant="primary"
            isLoading={isGenerating}
            maxWidth="md:max-w-5xl"
            extraActions={
                <Button 
                    onClick={handleSendToManager} 
                    variant="outline" 
                    isLoading={isSending}
                    disabled={isGenerating || isSending}
                >
                    <Send className="mr-2 h-4 w-4" />
                    Send to Manager
                </Button>
            }
        >
            <div className="flex justify-center bg-gray-100 p-2 md:p-4 -mx-6 -my-6 h-[70vh] overflow-auto">
                <div 
                    id="pdf-content-source"
                    className="bg-white shadow-lg p-[20px] md:p-[40px] min-w-[700px] min-h-[1100px] text-left mx-auto text-gray-900"
                    style={{ fontFamily: "'Helvetica', 'Arial', sans-serif", color: '#111827' }}
                >
                    {/* Re-using the same preview as before for UI consistency, while PDF uses FieldReportDocument */}
                    {/* Header */}
                    <div style={{ borderBottom: '3px solid #006B3F', paddingBottom: '20px', marginBottom: '30px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                        <div>
                            <h1 style={{ color: '#006B3F', margin: 0, fontSize: '24pt', fontWeight: 'bold' }}>FIELD REPORT</h1>
                            <p style={{ margin: '5pt 0 0 0', color: '#666666', fontSize: '11pt' }}>Paradigm Office Services • Digital Audit Record</p>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ display: 'inline-block', background: '#006B3F', color: 'white', padding: '4pt 12pt', borderRadius: '4px', fontWeight: 'bold', fontSize: '10pt', marginBottom: '8pt' }}>
                                ID: {report.id.substring(0, 8).toUpperCase()}
                            </div>
                            <p style={{ margin: 0, fontSize: '10pt', color: '#666666' }}>Date: {format(new Date(report.createdAt), 'PPPP')}</p>
                        </div>
                    </div>

                    {/* Details Grid */}
                    <div style={{ display: 'flex', gap: '20px', marginBottom: '30pt' }}>
                        <div style={{ flex: 1, background: '#F3F4F6', padding: '15pt', borderRadius: '10pt' }}>
                            <p style={{ margin: 0, fontSize: '9pt', color: '#9CA3AF', textTransform: 'uppercase', fontWeight: 600 }}>Submitter</p>
                            <p style={{ margin: '5pt 0 0 0', fontWeight: 'bold', fontSize: '12pt', color: '#111827' }}>{report.userName}</p>
                            <p style={{ margin: '2pt 0 0 0', fontSize: '10pt', color: '#4B5563' }}>Visit: {format(new Date(report.visitStartTime), 'HH:mm')} - {format(new Date(report.visitEndTime), 'HH:mm')}</p>
                        </div>
                        <div style={{ flex: 1, background: '#F3F4F6', padding: '15pt', borderRadius: '10pt' }}>
                            <p style={{ margin: 0, fontSize: '9pt', color: '#9CA3AF', textTransform: 'uppercase', fontWeight: 600 }}>Site Context</p>
                            <p style={{ margin: '5pt 0 0 0', fontWeight: 'bold', fontSize: '12pt', color: '#111827' }}>{report.siteName}</p>
                            <p style={{ margin: '2pt 0 0 0', fontSize: '10pt', color: '#4B5563' }}>{report.jobType} | {report.assetArea}</p>
                        </div>
                    </div>

                    {/* Checklist Section */}
                    <h2 style={{ borderLeft: '5pt solid #006B3F', paddingLeft: '10pt', color: '#111827', fontSize: '18pt', marginBottom: '15pt', fontWeight: 'bold' }}>Checklist Summary</h2>
                    
                    {template?.sections.map(section => (
                        <div key={section.id} style={{ marginBottom: '20pt' }}>
                            <div style={{ background: '#E5E7EB', padding: '8pt 12pt', borderRadius: '5pt', marginBottom: '10pt' }}>
                                <p style={{ margin: 0, fontWeight: 'bold', fontSize: '11pt', color: '#374151' }}>{section.title.toUpperCase()}</p>
                            </div>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <tbody>
                                    {section.items.map(item => {
                                        const resp = report.responses[item.id];
                                        const isNo = resp?.value === 'No';
                                        const isYes = resp?.value === 'Yes';
                                        
                                        const color = isNo ? '#DC2626' : isYes ? '#059669' : '#6B7280';
                                        const bg = isNo ? '#FEF2F2' : isYes ? '#ECFDF5' : '#F9FAFB';

                                        return (
                                            <React.Fragment key={item.id}>
                                                <tr>
                                                    <td style={{ padding: '10pt 0', borderBottom: '1px solid #E5E7EB', fontSize: '11pt', color: '#4B5563', verticalAlign: 'top' }}>{item.label}</td>
                                                    <td style={{ padding: '10pt 0', borderBottom: '1px solid #E5E7EB', textAlign: 'right', width: '80px', verticalAlign: 'top' }}>
                                                        <span style={{ fontWeight: 'bold', fontSize: '10pt', color: color, background: bg, padding: '2pt 6pt', borderRadius: '4px', display: 'inline-block' }}>
                                                            {String(resp?.value || 'N/A').toUpperCase()}
                                                        </span>
                                                    </td>
                                                </tr>
                                                {resp?.remarks && (
                                                    <tr>
                                                        <td colSpan={2} style={{ padding: '5pt 10pt 15pt 10pt', background: '#FFFBEB', fontSize: '10pt', color: '#92400E', fontStyle: 'italic', borderRadius: '4px' }}>
                                                            <strong>Note:</strong> {resp.remarks}
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    ))}
                    {!template && <p style={{ textAlign: 'center', color: '#999999', padding: '20pt' }}>Detailed checklist data unavailable.</p>}

                    {/* Management Review */}
                    <div>
                        <h2 style={{ borderLeft: '5pt solid #006B3F', paddingLeft: '10pt', color: '#111827', fontSize: '18pt', marginTop: '30pt', marginBottom: '15pt', fontWeight: 'bold' }}>Management Review</h2>
                        <div style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', padding: '20pt', borderRadius: '10pt' }}>
                            <p style={{ margin: 0, fontSize: '12pt', lineHeight: 1.6, color: '#374151', whiteSpace: 'pre-wrap' }}>{report.summary}</p>
                            {report.userRemarks && (
                                <div style={{ marginTop: '15pt', paddingTop: '10pt', borderTop: '1px dashed #D1D5DB' }}>
                                    <p style={{ margin: 0, fontSize: '9pt', fontWeight: 'bold', color: '#006B3F', textTransform: 'uppercase' }}>Staff Final Remarks</p>
                                    <p style={{ margin: '5pt 0 0 0', fontSize: '11pt', color: '#111827', whiteSpace: 'pre-wrap' }}>{report.userRemarks}</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {report.evidence && report.evidence.length > 0 && (
                        <div style={{ marginTop: '20pt', background: '#ECFDF5', border: '1px solid #A7F3D0', padding: '12pt', borderRadius: '8pt', display: 'flex', alignItems: 'center' }}>
                            <span style={{ fontSize: '20px', marginRight: '10px' }}>📸</span>
                            <span style={{ fontSize: '11pt', color: '#065F46' }}><strong>Captured Evidence:</strong> Attached {report.evidence.length} photos to this audit record.</span>
                        </div>
                    )}

                    {/* Footer */}
                    <div style={{ marginTop: '80pt', textAlign: 'center', borderTop: '1px solid #E5E7EB', paddingTop: '20pt' }}>
                        <p style={{ margin: 0, fontSize: '10pt', color: '#9CA3AF', fontWeight: 'bold' }}>Secure Document • General Audit Trail</p>
                        <p style={{ margin: '2pt 0 0 0', fontSize: '9pt', color: '#9CA3AF' }}>Generated by Paradigm Office v2.0</p>
                        <p style={{ margin: '5pt 0 0 0', fontSize: '9pt', color: '#9CA3AF', fontFamily: 'monospace' }}>Key: {report.id}</p>
                    </div>
                </div>
            </div>
        </Modal>
    );
};

const FieldReports: React.FC = () => {
    const { user } = useAuthStore();
    const [reports, setReports] = useState<(FieldReport & { userName: string; userRole: string })[]>([]);
    const [templates, setTemplates] = useState<Record<string, ChecklistTemplate>>({});
    const [totalReports, setTotalReports] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [startDate, setStartDate] = useState(format(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'));
    const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const [expandedReportId, setExpandedReportId] = useState<string | null>(null);
    const [previewReport, setPreviewReport] = useState<(FieldReport & { userName: string }) | null>(null);
    const [allUsers, setAllUsers] = useState<{ id: string, name: string }[]>([]);
    const [allSites, setAllSites] = useState<{ id: string, name: string }[]>([]);
    const [selectedUserId, setSelectedUserId] = useState('all');
    const [selectedSiteName, setSelectedSiteName] = useState('all');
    const { isMobile, isTablet } = useDevice();
    const [teamMemberIds, setTeamMemberIds] = useState<string[] | undefined>(undefined);

    // Visibility logic: admins and hr see everything. Others (managers) see only their team.
    const isRestricted = user && !['admin', 'hr'].includes(user.role);

    useEffect(() => {
        const fetchTeam = async () => {
            if (isRestricted && user) {
                try {
                    const users = await api.getUsers();
                    const team = users.filter(u => u.reportingManagerId === user.id).map(u => u.id);
                    // Include self in the team so they can see their own reports too
                    setTeamMemberIds([...team, user.id]);
                } catch (err) {
                    console.error("Failed to fetch team members:", err);
                }
            }
        };
        fetchTeam();
    }, [isRestricted, user]);

    useEffect(() => {
        const loadInitialData = async () => {
            // Wait for teamMemberIds to be loaded if restricted
            if (isRestricted && teamMemberIds === undefined) return;

            try {
                const { users, sites } = await api.getFieldReportFilterOptions(teamMemberIds);
                setAllUsers(users);
                setAllSites(sites.map(s => ({ id: s, name: s })));
            } catch (err) {
                console.error("Failed to load filter options:", err);
            }
        };
        loadInitialData();
    }, [teamMemberIds, isRestricted]);

    useEffect(() => {
        const fetchReports = async () => {
            setLoading(true);
            try {
                const [res, users] = await Promise.all([
                    api.getFieldReports({ 
                        startDate: new Date(startDate).toISOString(), 
                        endDate: new Date(endDate).toISOString(),
                        page: currentPage,
                        pageSize,
                        userId: selectedUserId,
                        siteName: selectedSiteName,
                        userIds: teamMemberIds
                    }),
                    api.getUsers()
                ]);

                const userMap = new Map(users.map(u => [u.id, u]));

                const enrichedReports = res.data.map(report => {
                    const u = userMap.get(report.userId) as User | undefined;
                    return {
                        ...report,
                        userName: u?.name || 'Unknown User',
                        userRole: u?.role || 'Unknown'
                    };
                });

                setReports(enrichedReports);
                setTotalReports(res.total);

                // Pre-fetch unique templates used in these reports
                const jobTypes = Array.from(new Set(res.data.map(r => r.jobType)));
                const templatePromises = jobTypes.map(type => api.getChecklistTemplates(type as string));
                const templateResults = await Promise.all(templatePromises);
                const templateMap: Record<string, ChecklistTemplate> = {};
                templateResults.flat().forEach(t => {
                    templateMap[t.id] = t;
                });
                setTemplates(templateMap);

            } catch (err) {
                console.error("Failed to fetch reports:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchReports();
    }, [currentPage, pageSize, startDate, endDate, selectedUserId, selectedSiteName, teamMemberIds]);

    useEffect(() => {
        setCurrentPage(1);
    }, [pageSize, startDate, endDate]);

    const toggleReportDetails = (id: string) => {
        setExpandedReportId(expandedReportId === id ? null : id);
    };

    if (loading) return (
        <div className="flex items-center justify-center min-h-[400px]">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent"></div>
        </div>
    );

    return (
        <div className="p-4 md:p-6 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className={`${isTablet ? 'text-lg' : 'text-2xl'} font-bold text-primary-text`}>Field Reports</h1>
                    {!isTablet && <p className="text-muted mt-1">Review detailed work summaries and verified checklists from field staff.</p>}
                </div>
            </div>

            <div className="bg-card p-5 rounded-xl border border-border shadow-sm space-y-4">
                <div className="flex flex-col md:flex-row gap-4 items-end">
                    <div className="flex-grow grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="lg:col-span-2">
                            <Input 
                                placeholder="Search by summary or job type..." 
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                icon={<Search className="h-4 w-4" />}
                            />
                        </div>
                        <div>
                            <Select 
                                value={selectedUserId}
                                onChange={e => setSelectedUserId(e.target.value)}
                                icon={<UserIcon className="h-4 w-4" />}
                            >
                                <option value="all">All Workers</option>
                                {allUsers.map(u => (
                                    <option key={u.id} value={u.id}>{u.name}</option>
                                ))}
                            </Select>
                        </div>
                        <div>
                            <Select 
                                value={selectedSiteName}
                                onChange={e => setSelectedSiteName(e.target.value)}
                                icon={<MapPin className="h-4 w-4" />}
                            >
                                <option value="all">All Sites</option>
                                {allSites.map(s => (
                                    <option key={s.id} value={s.name}>{s.name}</option>
                                ))}
                            </Select>
                        </div>
                    </div>
                    <Button variant="secondary" onClick={() => { 
                        setSearchTerm(''); 
                        setStartDate(format(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd')); 
                        setEndDate(format(new Date(), 'yyyy-MM-dd')); 
                        setSelectedUserId('all');
                        setSelectedSiteName('all');
                    }} className="flex-shrink-0">
                        <FilterX className="h-4 w-4 mr-2" /> Reset
                    </Button>
                </div>
                
                <div className="flex flex-col md:flex-row items-center gap-4 pt-4 border-t border-border/50">
                    <div className="flex items-center gap-2 w-full md:w-auto">
                        <Calendar className="h-4 w-4 text-muted" />
                        <span className="text-xs font-bold text-muted uppercase tracking-wider">Date Range:</span>
                    </div>
                    <div className="flex gap-2 w-full md:w-auto">
                        <div className="w-full md:w-40">
                            <Input label="" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                        </div>
                        <div className="flex items-center text-muted">to</div>
                        <div className="w-full md:w-40">
                            <Input label="" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6">
                {reports.length === 0 ? (
                    <div className="bg-card rounded-xl border border-border p-12 text-center shadow-sm">
                        <FileText className="h-12 w-12 text-muted mx-auto mb-4 opacity-50" />
                        <h3 className="text-lg font-medium text-primary-text">No reports found</h3>
                        <p className="text-muted mt-2">Field reports submitted will appear here.</p>
                    </div>
                ) : (
                    reports
                    .filter(r => 
                        r.summary.toLowerCase().includes(searchTerm.toLowerCase()) || 
                        r.jobType.toLowerCase().includes(searchTerm.toLowerCase())
                    )
                    .map(report => {
                        const isExpanded = expandedReportId === report.id;
                        const template = templates[report.templateId];
                        
                        return (
                            <div key={report.id} className={`bg-card rounded-xl border border-border shadow-sm hover:shadow-md transition-all overflow-hidden ${isExpanded ? 'ring-2 ring-accent/20' : ''}`}>
                                {/* Header / Summary Row */}
                                <div 
                                    className={`${isTablet ? 'p-3' : 'p-5'} flex flex-col md:flex-row justify-between md:items-center gap-4 cursor-pointer hover:bg-muted/50 transition-colors ${isExpanded ? 'bg-muted/30 border-b border-border' : ''}`}
                                    onClick={() => toggleReportDetails(report.id)}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`rounded-xl bg-accent/10 flex items-center justify-center text-accent font-bold ${isTablet ? 'w-8 h-8 text-sm' : 'w-10 h-10'}`}>
                                            {report.userName.charAt(0)}
                                        </div>
                                        <div>
                                            <h3 className={`font-bold text-primary-text ${isTablet ? 'text-sm' : ''}`}>{report.userName}</h3>
                                            <div className="flex items-center gap-2 text-xs text-muted">
                                                <span className="px-2 py-0.5 rounded-full bg-accent/10 text-accent capitalize">{report.userRole.replace(/_/g, ' ')}</span>
                                                <span>•</span>
                                                <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {format(new Date(report.createdAt), 'MMM d, h:mm a')}</span>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="flex flex-wrap items-center gap-3">
                                        <div className="flex items-center gap-1.5 text-sm text-muted bg-muted/30 px-3 py-1.5 rounded-lg border border-border">
                                            <MapPin className="h-4 w-4 text-accent" />
                                            {report.siteName}
                                        </div>
                                        <div className="flex items-center gap-1.5 text-sm text-muted bg-muted/30 px-3 py-1.5 rounded-lg border border-border">
                                            <Briefcase className="h-4 w-4 text-accent" />
                                            {report.jobType}
                                        </div>
                                        {isExpanded ? <ChevronUp className="h-5 w-5 text-muted" /> : <ChevronDown className="h-5 w-5 text-muted" />}
                                    </div>
                                </div>
                                
                                {/* Detailed View */}
                                {isExpanded && (
                                    <div className={`${isTablet ? 'p-4' : 'p-6'} bg-card space-y-8 animate-in fade-in slide-in-from-top-4 duration-300`}>
                                        {/* Action Bar */}
                                        <div className="flex justify-between items-center bg-muted/20 p-4 rounded-xl border border-border">
                                            <div className="flex items-center gap-2 text-sm font-medium text-primary-text">
                                                <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                                                Verified Audit Trail Info
                                            </div>
                                            <button 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setPreviewReport(report);
                                                }}
                                                className={`flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 text-sm font-medium transition-colors border border-primary/20 shadow-sm ${isMobile ? 'w-full justify-center' : ''}`}
                                            >
                                                <Download className="h-4 w-4" />
                                                Preview & Download PDF
                                            </button>
                                        </div>

                                        <div className={`grid grid-cols-1 md:grid-cols-2 ${isTablet ? 'lg:grid-cols-2' : 'lg:grid-cols-3'} gap-8`}>
                                            {/* Left Column: Response Values */}
                                            <div className="md:col-span-2 space-y-6">
                                                <div className="bg-muted/10 rounded-2xl border border-border/50 overflow-hidden">
                                                    <div className="bg-muted/30 px-4 py-3 border-b border-border/50 flex items-center gap-2">
                                                        <ClipboardCheck className="h-4 w-4 text-accent" />
                                                        <span className="text-sm font-bold text-primary-text uppercase tracking-wider">Verified Checklist Data</span>
                                                    </div>
                                                    <div className="p-4 space-y-6">
                                                        {template ? template.sections.map((section, sIndex) => (
                                                            <div key={section.id} className="space-y-3">
                                                                <h4 className="text-xs font-bold text-accent uppercase flex items-center gap-2">
                                                                    <span className="w-1 h-4 bg-accent rounded-full" />
                                                                    {section.title}
                                                                </h4>
                                                                <div className="space-y-2">
                                                                    {section.items.map(item => {
                                                                        const resp = report.responses[item.id];
                                                                        return (
                                                                            <div key={item.id} className="bg-card border border-border/40 rounded-xl p-3 flex flex-col gap-2">
                                                                                <div className="flex justify-between items-start gap-4">
                                                                                    <span className="text-sm text-primary-text font-medium">{item.label}</span>
                                                                                    <span className={`text-xs font-bold px-2 py-1 rounded-lg ${
                                                                                        resp?.value === 'No' ? 'bg-red-100 text-red-600' : 
                                                                                        resp?.value === 'Yes' ? 'bg-emerald-100 text-emerald-600' :
                                                                                        'bg-muted text-muted-foreground'
                                                                                    }`}>
                                                                                        {resp?.value || 'N/A'}
                                                                                    </span>
                                                                                </div>
                                                                                {resp?.remarks && (
                                                                                    <div className="text-xs text-muted bg-muted/30 p-2 rounded-lg italic">
                                                                                        Note: {resp.remarks}
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </div>
                                                        )) : (
                                                            <div className="text-center py-8 text-muted italic">
                                                                Checklist template not found for this report type.
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Right Column: Evidence & Summary */}
                                            <div className="space-y-6">
                                                {/* Work Summary Block */}
                                                <div className="bg-accent/5 border border-accent/20 rounded-2xl p-5 space-y-3">
                                                    <h4 className="text-xs font-bold text-accent uppercase tracking-widest">Management Summary</h4>
                                                    <p className="text-sm text-primary-text leading-relaxed whitespace-pre-wrap">
                                                        {report.summary}
                                                    </p>
                                                    {report.userRemarks && (
                                                        <div className="mt-4 pt-4 border-t border-accent/10">
                                                            <h5 className="text-[10px] font-bold text-red-500 uppercase mb-1">Staff Final Remarks</h5>
                                                            <p className="text-xs text-red-700 font-medium">{report.userRemarks}</p>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Evidence Gallery */}
                                                <div className="space-y-3">
                                                    <h4 className="text-xs font-bold text-muted uppercase tracking-widest flex items-center gap-2">
                                                        <ImageIcon className="h-3 w-3" />
                                                        Collected Evidence
                                                    </h4>
                                                    <div className="grid grid-cols-2 gap-3">
                                                        {report.evidence && report.evidence.length > 0 ? report.evidence.map((ev, i) => (
                                                            <div key={i} className="group relative aspect-square rounded-xl overflow-hidden border border-border bg-muted/20">
                                                                <img src={ev.url} alt="Field Evidence" className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                                                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
                                                                    <span className="text-[8px] text-white font-medium uppercase">{ev.category} • {format(new Date(ev.timestamp), 'HH:mm')}</span>
                                                                </div>
                                                            </div>
                                                        )) : (
                                                            <div className="col-span-2 border-2 border-dashed border-border rounded-xl p-6 text-center">
                                                                <ImageIcon className="h-6 w-6 text-muted-foreground/30 mx-auto mb-2" />
                                                                <p className="text-[10px] text-muted">No evidence photos captured</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>

            <Pagination 
                currentPage={currentPage}
                totalItems={totalReports}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                onPageSizeChange={setPageSize}
                className="mt-8"
            />

            {/* PDF Preview Modal */}
            <PdfPreviewModal 
                isOpen={!!previewReport}
                onClose={() => setPreviewReport(null)}
                report={previewReport}
                template={previewReport ? templates[previewReport.templateId] : undefined}
            />
        </div>
    );
};

export default FieldReports;
