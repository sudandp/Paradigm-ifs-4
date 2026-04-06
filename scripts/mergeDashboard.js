import fs from 'fs';

try {
    let att = fs.readFileSync('e:/backup/onboarding all files/Paradigm Office 4/pages/attendance/AttendanceDashboard_Backup.tsx', 'utf-8');

    // Find the start of the return (the UI section)
    let uiStart = att.indexOf('return (', att.indexOf('if (isLoading)'));
    let logicPart = att.substring(0, uiStart);

    // Inject our unified report logic inside logicPart
    logicPart = logicPart.replace('AttendanceDashboard: React.FC', 'ReportsDashboard: React.FC');
    
    // Replace state conflicts (we need selectedReport and we don't care about activeTab)
    logicPart = logicPart.replace(
        'const [activeTab, setActiveTab] = useState<\'attendance\' | \'overview\'>(\'overview\');', 
        'const [activeTab, setActiveTab] = useState(\'overview\');\n    const [selectedReport, setSelectedReport] = useState<any>(\'unified\');\n'
    );
    
    // Fix imports - add missing lucide icons and views
    const importsToAdd = `
import { FileText, Calendar, Filter, FileSpreadsheet, AlertCircle } from 'lucide-react';
import { exportGenericReportToExcel } from '../../utils/excelExport';
import { BasicReportView, AttendanceLogView, MonthlyStatusView, SiteOtReportView, WorkHoursReportView } from '../../components/attendance/ReportHTMLViews';
`;
    logicPart = logicPart.replace("import React", importsToAdd + "\nimport React");

    let uiPart = fs.readFileSync('e:/backup/onboarding all files/Paradigm Office 4/pages/reports/ReportsDashboard.tsx', 'utf-8');
    let dashboardUI = uiPart.substring(uiPart.indexOf('return ('));

    // Fix UI mapping inside dashboardUI:
    // Replace mockup code with actual conditionals:
    dashboardUI = dashboardUI.replace(
        '{previewData ? (',
        `{selectedReport === 'basic' && <BasicReportView data={basicReportData} dateRange={{ startDate: new Date(dateRange.startDate), endDate: new Date(dateRange.endDate) }} />}
         {selectedReport === 'monthly' && <MonthlyStatusView data={monthlyReportData} dateRange={{ startDate: new Date(dateRange.startDate), endDate: new Date(dateRange.endDate) }} />}
         {selectedReport === 'log' && <AttendanceLogView data={attendanceLogData} dateRange={{ startDate: new Date(dateRange.startDate), endDate: new Date(dateRange.endDate) }} />}
         {selectedReport === 'work_hours' && <WorkHoursReportView data={work_hoursReportData} dateRange={{ startDate: new Date(dateRange.startDate), endDate: new Date(dateRange.endDate) }} />}
         {selectedReport === 'site_ot' && <SiteOtReportView data={site_otReportData} dateRange={{ startDate: new Date(dateRange.startDate), endDate: new Date(dateRange.endDate) }} />}
         {previewData ? (`
    );

    // Change handleGeneratePreview to not replace previewData mock but do nothing or compute unified
    // ...

    // Tie them together
    let newFile = logicPart + '    // UI from ReportsDashboard \n    ' + dashboardUI;

    // Finally, handle the export name
    newFile = newFile.replace('export default AttendanceDashboard;', 'export default ReportsDashboard;');

    fs.writeFileSync('e:/backup/onboarding all files/Paradigm Office 4/pages/reports/ReportsDashboard.tsx', newFile);
    console.log('Merged successfully!');
} catch(e) {
    console.error(e);
}
