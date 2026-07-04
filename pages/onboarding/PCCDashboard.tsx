import React, { useState } from 'react';
import FormHeader from '../../components/onboarding/FormHeader';
import Button from '../../components/ui/Button';
import { Search, Filter, ShieldCheck, ShieldAlert, Clock, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';

interface PCCRecord {
    id: string;
    employeeName: string;
    employeeId: string;
    role: string;
    site: string;
    status: 'Pending' | 'Initiated' | 'Cleared' | 'Rejected';
    initiatedDate?: string;
    clearedDate?: string;
    documentUrl?: string;
}

const MOCK_PCC_DATA: PCCRecord[] = [
    { id: '1', employeeName: 'Ramesh Kumar', employeeId: 'E101', role: 'Security Guard', site: 'Embassy Tech Village', status: 'Cleared', initiatedDate: '2026-06-15', clearedDate: '2026-07-02' },
    { id: '2', employeeName: 'Sita Devi', employeeId: 'E102', role: 'Housekeeping', site: 'Manyata Tech Park', status: 'Pending' },
    { id: '3', employeeName: 'Manoj Singh', employeeId: 'E103', role: 'Supervisor', site: 'EcoSpace', status: 'Initiated', initiatedDate: '2026-06-28' },
    { id: '4', employeeName: 'Abdul Khan', employeeId: 'E104', role: 'Security Guard', site: 'Prestige Tech Park', status: 'Rejected', initiatedDate: '2026-06-20' },
];

const PCCDashboard = () => {
    const [records, setRecords] = useState<PCCRecord[]>(MOCK_PCC_DATA);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<string>('All');

    const handleInitiate = (id: string) => {
        setRecords(records.map(r => r.id === id ? { ...r, status: 'Initiated', initiatedDate: new Date().toISOString().split('T')[0] } : r));
        toast.success('PCC process initiated successfully');
    };

    const handleClear = (id: string) => {
        setRecords(records.map(r => r.id === id ? { ...r, status: 'Cleared', clearedDate: new Date().toISOString().split('T')[0] } : r));
        toast.success('PCC marked as Cleared');
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'Cleared': return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1"/> Cleared</span>;
            case 'Initiated': return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"><Clock className="w-3 h-3 mr-1"/> Initiated</span>;
            case 'Rejected': return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800"><ShieldAlert className="w-3 h-3 mr-1"/> Rejected</span>;
            case 'Pending': 
            default: return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800"><Clock className="w-3 h-3 mr-1"/> Pending</span>;
        }
    };

    const filteredRecords = records.filter(r => {
        const matchesSearch = r.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) || r.employeeId.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = filterStatus === 'All' || r.status === filterStatus;
        return matchesSearch && matchesStatus;
    });

    return (
        <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center">
                        <ShieldCheck className="mr-3 h-8 w-8 text-indigo-600" />
                        PCC Lifecycle Dashboard
                    </h1>
                    <p className="mt-2 text-sm text-gray-600">
                        Track Police Clearance Certificate statuses for all active and onboarding employees.
                    </p>
                </div>
                <div className="mt-4 sm:mt-0 flex gap-4">
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search className="h-5 w-5 text-gray-400" />
                        </div>
                        <input
                            type="text"
                            placeholder="Search employee..."
                            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="relative">
                         <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Filter className="h-5 w-5 text-gray-400" />
                        </div>
                        <select
                            className="block w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md leading-5 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                        >
                            <option value="All">All Statuses</option>
                            <option value="Pending">Pending</option>
                            <option value="Initiated">Initiated</option>
                            <option value="Cleared">Cleared</option>
                            <option value="Rejected">Rejected</option>
                        </select>
                    </div>
                </div>
            </div>

            <div className="bg-white shadow overflow-hidden sm:rounded-lg border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Site / Role</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dates</th>
                            <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {filteredRecords.map((record) => (
                            <tr key={record.id} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex items-center">
                                        <div className="flex-shrink-0 h-10 w-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-700 font-bold">
                                            {record.employeeName.charAt(0)}
                                        </div>
                                        <div className="ml-4">
                                            <div className="text-sm font-medium text-gray-900">{record.employeeName}</div>
                                            <div className="text-sm text-gray-500">{record.employeeId}</div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm text-gray-900">{record.site}</div>
                                    <div className="text-sm text-gray-500">{record.role}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    {getStatusBadge(record.status)}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {record.initiatedDate && <div>Initiated: {record.initiatedDate}</div>}
                                    {record.clearedDate && <div className="text-green-600">Cleared: {record.clearedDate}</div>}
                                    {!record.initiatedDate && !record.clearedDate && <span>-</span>}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    {record.status === 'Pending' && (
                                        <Button size="sm" variant="outline" onClick={() => handleInitiate(record.id)}>Initiate</Button>
                                    )}
                                    {record.status === 'Initiated' && (
                                        <Button size="sm" variant="primary" onClick={() => handleClear(record.id)}>Mark Cleared</Button>
                                    )}
                                </td>
                            </tr>
                        ))}
                        {filteredRecords.length === 0 && (
                            <tr>
                                <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                                    No PCC records found matching your filters.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default PCCDashboard;
