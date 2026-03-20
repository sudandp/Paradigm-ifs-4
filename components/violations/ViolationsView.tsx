import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { AlertTriangle, CheckCircle, Download, FileText, ShieldAlert } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import Button from '../ui/Button';
import Input from '../ui/Input';
import type { FieldAttendanceViolation, User } from '../../types';
import { api } from '../../services/api';

interface ViolationsViewProps {
  userId: string;
  userName: string;
  isManager?: boolean;
}

const ViolationsView: React.FC<ViolationsViewProps> = ({ userId, userName, isManager = false }) => {
  const { user: manager } = useAuthStore();
  const [violations, setViolations] = useState<FieldAttendanceViolation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedViolation, setSelectedViolation] = useState<FieldAttendanceViolation | null>(null);
  const [acknowledgmentNotes, setAcknowledgmentNotes] = useState('');
  const [isAcknowledging, setIsAcknowledging] = useState(false);

  useEffect(() => {
    loadViolations();
  }, [userId]);

  const loadViolations = async () => {
    setLoading(true);
    try {
      const data = await api.getFieldViolations(userId);
      setViolations(data);
    } catch (error) {
      console.error('Error loading violations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAcknowledge = async (violationId: string) => {
    if (!acknowledgmentNotes.trim()) {
      alert('Please provide notes for the acknowledgment');
      return;
    }

    setIsAcknowledging(true);
    try {
      await api.acknowledgeFieldViolation(violationId, acknowledgmentNotes);
      setAcknowledgmentNotes('');
      setSelectedViolation(null);
      loadViolations();
      alert('Violation acknowledged successfully. Attendance has been granted for this day.');
    } catch (error) {
      console.error('Error acknowledging violation:', error);
      alert('Failed to acknowledge violation');
    } finally {
      setIsAcknowledging(false);
    }
  };

  const exportViolations = async () => {
    try {
      await api.exportFieldViolations(userId, userName);
    } catch (error) {
      console.error('Error exporting violations:', error);
      alert('Failed to export violations');
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-muted">Loading violations...</div>;
  }

  const pendingViolations = violations.filter(v => v.status === 'pending');
  const acknowledgedViolations = violations.filter(v => v.status === 'acknowledged');
  const escalatedViolations = violations.filter(v => v.status === 'escalated');

  return (
    <div className="space-y-6">
      {/* Header with Export */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold text-primary-text">Field Staff Violations</h3>
          <p className="text-sm text-muted">Site time and working hours violations requiring manager acknowledgment</p>
        </div>
        <Button onClick={exportViolations} variant="secondary" size="sm">
          <Download className="mr-2 h-4 w-4" /> Export Report
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 border border-border rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted">Pending</p>
              <p className="text-2xl font-bold text-orange-400">{pendingViolations.length}</p>
            </div>
            <AlertTriangle className="h-8 w-8 text-orange-400" />
          </div>
        </div>
        <div className="p-4 border border-border rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted">Acknowledged</p>
              <p className="text-2xl font-bold text-green-400">{acknowledgedViolations.length}</p>
            </div>
            <CheckCircle className="h-8 w-8 text-green-400" />
          </div>
        </div>
        <div className="p-4 border border-border rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted">Escalated</p>
              <p className="text-2xl font-bold text-red-400">{escalatedViolations.length}</p>
            </div>
            <FileText className="h-8 w-8 text-red-400" />
          </div>
        </div>
      </div>

      {/* Violations Table */}
      {violations.length === 0 ? (
        <div className="text-center py-12 bg-card border border-border rounded-lg">
          <CheckCircle className="mx-auto h-12 w-12 text-green-400 mb-3" />
          <p className="text-muted">No violations found</p>
        </div>
      ) : (
        <div className="overflow-x-auto border border-border rounded-lg">
          <table className="w-full">
            <thead className="bg-muted/20 border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-primary-text">Date</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-primary-text">Violation Type</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-primary-text">Total Hours</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-primary-text">Site %</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-primary-text">Travel %</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-primary-text">Required Site %</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-primary-text">Status</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-primary-text">User Reason</th>
                {isManager && <th className="px-4 py-3 text-left text-sm font-medium text-primary-text">Action</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {violations.map((violation) => (
                <tr key={violation.id} className="hover:bg-muted/10">
                  <td className="px-4 py-3 text-sm text-primary-text">
                    {format(new Date(violation.date), 'MMM dd, yyyy')}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      violation.violationType === 'site_time_low' ? 'bg-orange-500/20 text-orange-400' : 'bg-red-500/20 text-red-400'
                    }`}>
                      {violation.violationType === 'site_time_low' ? 'Low Site Time' : 'Insufficient Hours'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-primary-text">{violation.totalHours.toFixed(2)} hrs</td>
                  <td className="px-4 py-3 text-sm">
                    <span className={violation.sitePercentage < violation.requiredSitePercentage ? 'text-red-400 font-medium' : 'text-green-400'}>
                      {violation.sitePercentage.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-primary-text">{violation.travelPercentage.toFixed(1)}%</td>
                  <td className="px-4 py-3 text-sm text-muted">{violation.requiredSitePercentage}%</td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      violation.status === 'pending' ? 'bg-orange-500/20 text-orange-400' :
                      violation.status === 'acknowledged' ? 'bg-green-500/20 text-green-400' :
                      'bg-red-500/20 text-red-400'
                    }`}>
                      {violation.status.charAt(0).toUpperCase() + violation.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted italic max-w-xs truncate">
                    {violation.userReason || '-'}
                  </td>
                  {isManager && (
                    <td className="px-4 py-3 text-sm">
                      {violation.status === 'pending' && (
                        <Button
                          size="sm"
                          onClick={() => setSelectedViolation(violation)}
                        >
                          Acknowledge
                        </Button>
                      )}
                      {violation.status === 'acknowledged' && violation.managerNotes && (
                        <button
                          className="text-blue-400 hover:text-blue-300 text-xs underline"
                          onClick={() => alert(violation.managerNotes)}
                        >
                          View Notes
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Acknowledgment Modal */}
      {selectedViolation && isManager && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-lg max-w-lg w-full p-6">
            <h3 className="text-lg font-semibold text-primary-text mb-4">Acknowledge Violation</h3>
            
            <div className="space-y-3 mb-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted">Date:</span>
                <span className="text-primary-text">{format(new Date(selectedViolation.date), 'MMM dd, yyyy')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Site Time:</span>
                <span className="text-primary-text">{selectedViolation.siteHours.toFixed(2)} hrs ({selectedViolation.sitePercentage.toFixed(1)}%)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Travel Time:</span>
                <span className="text-primary-text">{selectedViolation.travelHours.toFixed(2)} hrs ({selectedViolation.travelPercentage.toFixed(1)}%)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Required Site %:</span>
                <span className="text-primary-text">{selectedViolation.requiredSitePercentage}%</span>
              </div>
            </div>

            <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg mb-4">
              <p className="text-sm text-blue-400">
                <strong>Note:</strong> Acknowledging this violation will grant <strong>(P) Present</strong> status for this day and may affect salary/performance review.
              </p>
            </div>

            <div>
              <label htmlFor="acknowledgmentNotes" className="block text-sm font-medium text-primary-text mb-2">
                Manager Notes (Required)
              </label>
              <textarea
                id="acknowledgmentNotes"
                rows={4}
                value={acknowledgmentNotes}
                onChange={(e) => setAcknowledgmentNotes(e.target.value)}
                placeholder="Provide reason for acknowledgment..."
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-primary-text focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div className="flex gap-3 mt-6">
              <Button
                onClick={() => handleAcknowledge(selectedViolation.id)}
                isLoading={isAcknowledging}
                disabled={!acknowledgmentNotes.trim()}
              >
                Acknowledge & Grant Present
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setSelectedViolation(null);
                  setAcknowledgmentNotes('');
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Monthly Reset Section for Managers */}
      {isManager && violations.length >= 3 && (
        <div className="p-6 bg-orange-500/5 border border-orange-500/20 rounded-xl mt-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-1">
              <h4 className="text-lg font-bold text-orange-400 flex items-center gap-2">
                <ShieldAlert className="w-5 h-5" />
                Monthly Strike Reset
              </h4>
              <p className="text-sm text-muted max-w-xl">
                If the employee has provided valid reasons for all violations this month, you can reset their strike count. 
                This will unblock their access and remove salary holds.
              </p>
            </div>
            <Button 
               variant="outline" 
               className="border-orange-500/50 text-orange-400 hover:bg-orange-500/10"
               onClick={async () => {
                 const reason = prompt('Please provide a reason for resetting this month\'s violations (Optional):');
                 if (reason === null) return; // User clicked Cancel

                 try {
                   const currentMonth = format(new Date(), 'yyyy-MM');
                   await api.resetFieldViolationsForMonth(userId, currentMonth, manager?.id || '', reason);
                   alert('Month reset successful. Strikes cleared and salary hold removed.');
                   loadViolations();
                 } catch (e) {
                   console.error('Reset failed:', e);
                   alert('Failed to reset month.');
                 }
               }}
            >
              Allow user to work and start fresh
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ViolationsView;
