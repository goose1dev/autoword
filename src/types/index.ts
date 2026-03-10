export interface DocumentTemplate {
  id: string;
  name: string;
  fileName: string;
  fileSize: number;
  uploadedAt: Date;
  fields: TemplateField[];
  rawFile: File;
  htmlPreview: string;
}

export interface TemplateField {
  id: string;
  key: string;
  label: string;
  type: 'text' | 'date' | 'number' | 'select';
  defaultValue: string;
  options?: string[];
}

export interface DocumentInstance {
  id: string;
  templateId: string;
  name: string;
  fieldValues: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
}

export interface BatchJob {
  id: string;
  templateId: string;
  documents: DocumentInstance[];
  createdAt: Date;
}

export type UserRole = 'admin' | 'user';

export interface AppUser {
  id: string;
  username: string;
  displayName: string;
  role: UserRole;
  createdAt: string;
}

export type TemplateRequestStatus = 'pending' | 'approved' | 'rejected';

export interface TemplateRequest {
  id: string;
  name: string;
  description: string;
  submittedBy: string;
  fileName: string;
  fileSize: number;
  submittedAt: Date;
  status: TemplateRequestStatus;
  reviewedAt?: Date;
  reviewComment?: string;
  fields: TemplateField[];
  rawFile: File;
  htmlPreview: string;
}

export type ViewMode = 'grid' | 'list';

export type PageRoute = 'dashboard' | 'templates' | 'editor' | 'batch' | 'settings';
