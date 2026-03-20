import React, { useState, useEffect } from 'react';
import { Shield, Check, X, AlertCircle, ChevronRight } from 'lucide-react';
import Button from '../../components/ui/Button';
import { 
  PermissionType, 
  checkPermission, 
  requestPermission,
  PermissionState 
} from '../../utils/permissions';
import LoadingScreen from '../../components/ui/LoadingScreen';

interface PermissionInfo {
  type: PermissionType;
  name: string;
  description: string;
  icon: string;
}

const permissions: PermissionInfo[] = [
  {
    type: 'camera',
    name: 'Camera',
    description: 'Required for capturing photos, profile pictures, and document verification',
    icon: '📷'
  },
  {
    type: 'geolocation',
    name: 'Location',
    description: 'Required for attendance check-in/out with geofencing',
    icon: '📍'
  },
  {
    type: 'microphone',
    name: 'Microphone',
    description: 'May be required for voice notes or audio features',
    icon: '🎤'
  },
  {
    type: 'calendar',
    name: 'Calendar',
    description: 'Access calendar for scheduling and event management',
    icon: '📅'
  },
  {
    type: 'contacts',
    name: 'Contacts',
    description: 'Access contacts for team member selection',
    icon: '👥'
  },
  {
    type: 'activity',
    name: 'Physical Activity',
    description: 'Track activity for attendance and wellness features',
    icon: '🏃'
  }
];

const PermissionsPage: React.FC = () => {
  const [permissionStatuses, setPermissionStatuses] = useState<Record<PermissionType, PermissionState>>({} as any);
  const [loading, setLoading] = useState<PermissionType | null>(null);

  useEffect(() => {
    // Load initial permission statuses
    const loadStatuses = async () => {
      const statuses: Partial<Record<PermissionType, PermissionState>> = {};
      for (const perm of permissions) {
        statuses[perm.type] = await checkPermission(perm.type);
      }
      setPermissionStatuses(statuses as Record<PermissionType, PermissionState>);
    };
    loadStatuses();
  }, []);

  const handleRequestPermission = async (type: PermissionType) => {
    setLoading(type);
    try {
      const granted = await requestPermission(type);
      setPermissionStatuses(prev => ({
        ...prev,
        [type]: granted ? 'granted' : 'denied'
      }));
    } catch (error) {
      console.error(`Failed to request ${type} permission:`, error);
    } finally {
      setLoading(null);
    }
  };

  const getStatusIcon = (status: PermissionState) => {
    switch (status) {
      case 'granted':
        return <Check className="h-5 w-5 text-green-500" />;
      case 'denied':
        return <X className="h-5 w-5 text-red-500" />;
      default:
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
    }
  };

  const getStatusText = (status: PermissionState) => {
    switch (status) {
      case 'granted':
        return 'Allowed';
      case 'denied':
        return 'Denied';
      case 'limited':
        return 'Limited';
      default:
        return 'Not Set';
    }
  };

  const getStatusColor = (status: PermissionState) => {
    switch (status) {
      case 'granted':
        return 'text-green-600';
      case 'denied':
        return 'text-red-600';
      default:
        return 'text-yellow-600';
    }
  };

  if (loading) {
      return <LoadingScreen message="Loading page data..." />;
  }

  return (
    <div className="min-h-screen bg-page p-4 pb-24">
      <div className="">
        {/* Header */}
        <div className="mb-6 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-accent-light rounded-full mb-4">
            <Shield className="h-8 w-8 text-accent" />
          </div>
          <h1 className="text-2xl font-bold text-primary-text mb-2">App Permissions</h1>
          <p className="text-muted">
            Manage what the app can access. Permissions are requested only when needed.
          </p>
        </div>

        {/* Permissions List */}
        <div className="space-y-3">
          {permissions.map(permission => {
            const status = permissionStatuses[permission.type];
            const isLoading = loading === permission.type;

            return (
              <div
                key={permission.type}
                className="bg-card rounded-lg border border-border p-4 shadow-sm"
              >
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div className="text-3xl flex-shrink-0">
                    {permission.icon}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-semibold text-primary-text">
                        {permission.name}
                      </h3>
                      <div className="flex items-center gap-2">
                        {status && getStatusIcon(status)}
                        <span className={`text-sm font-medium ${status && getStatusColor(status)}`}>
                          {status ? getStatusText(status) : '...'}
                        </span>
                      </div>
                    </div>
                    <p className="text-sm text-muted mb-3">
                      {permission.description}
                    </p>

                    {/* Action Button */}
                    {status !== 'granted' && (
                      <Button
                        size="sm"
                        variant={status === 'denied' ? 'secondary' : 'primary'}
                        onClick={() => handleRequestPermission(permission.type)}
                        isLoading={isLoading}
                        className="w-full sm:w-auto"
                      >
                        {status === 'denied' ? 'Request Again' : 'Grant Permission'}
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Info Box */}
        <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <div className="flex gap-3">
            <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-900 dark:text-blue-100">
              <p className="font-medium mb-1">Just-in-Time Permissions</p>
              <p className="text-blue-700 dark:text-blue-300">
                Permissions are requested only when you use features that need them. 
                You can grant or deny them at any time from here or your device settings.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PermissionsPage;
