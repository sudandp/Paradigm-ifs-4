// Enterprise Controls Module Type Definitions

export type AuditActionType = 'INSERT' | 'UPDATE' | 'DELETE';

export interface SystemAuditLog {
  id: string;
  organizationId?: string;
  userId?: string;
  userName?: string; // Joined from users/profiles
  userEmail?: string;
  
  moduleName: string;
  tableName: string;
  actionType: AuditActionType;
  
  recordId: string;
  
  oldData?: any;
  newData?: any;
  
  ipAddress?: string;
  createdAt: string;
}

export type ApprovalStatus = 'Pending' | 'Approved' | 'Rejected';

export interface OpsApprovalRequest {
  id: string;
  organizationId?: string;
  entityId: string;
  entityName?: string; // Joined
  
  moduleName: string; // 'Quotation' | 'Contract'
  recordId: string;
  title: string;
  
  requestedBy?: string;
  requestedByName?: string; // Joined
  
  approvalStage: number;
  requiredRole: string;
  
  status: ApprovalStatus;
  
  approverId?: string;
  approverName?: string; // Joined
  comments?: string;
  
  createdAt: string;
  updatedAt: string;
}
