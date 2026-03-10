import { create } from 'zustand';
import type { DocumentTemplate, DocumentInstance, TemplateRequest } from '@/types/index.ts';
import {
  convertDocxToHtml,
  extractFields,
  generateId,
} from '@/services/documentService.ts';

interface DocumentStore {
  templates: DocumentTemplate[];
  documents: DocumentInstance[];
  activeTemplateId: string | null;
  templateRequests: TemplateRequest[];

  addTemplate: (file: File) => Promise<void>;
  removeTemplate: (id: string) => void;
  setActiveTemplate: (id: string | null) => void;

  submitTemplateRequest: (file: File, submittedBy: string, description: string) => Promise<void>;
  approveRequest: (id: string, comment?: string) => void;
  rejectRequest: (id: string, comment: string) => void;
  removeRequest: (id: string) => void;

  addDocument: (templateId: string, name: string, values: Record<string, string>) => void;
  updateDocument: (id: string, values: Record<string, string>) => void;
  removeDocument: (id: string) => void;

  batchUpdateField: (templateId: string, fieldKey: string, value: string) => void;
}

export const useDocumentStore = create<DocumentStore>((set) => ({
  templates: [],
  documents: [],
  activeTemplateId: null,
  templateRequests: [],

  addTemplate: async (file: File) => {
    const htmlPreview = await convertDocxToHtml(file);
    const fields = extractFields(htmlPreview);

    const template: DocumentTemplate = {
      id: generateId(),
      name: file.name.replace(/\.docx$/i, ''),
      fileName: file.name,
      fileSize: file.size,
      uploadedAt: new Date(),
      fields,
      rawFile: file,
      htmlPreview,
    };

    set((state) => ({
      templates: [...state.templates, template],
      activeTemplateId: state.activeTemplateId ?? template.id,
    }));
  },

  removeTemplate: (id: string) => {
    set((state) => ({
      templates: state.templates.filter((t) => t.id !== id),
      documents: state.documents.filter((d) => d.templateId !== id),
      activeTemplateId: state.activeTemplateId === id ? null : state.activeTemplateId,
    }));
  },

  setActiveTemplate: (id: string | null) => {
    set({ activeTemplateId: id });
  },

  addDocument: (templateId: string, name: string, values: Record<string, string>) => {
    const doc: DocumentInstance = {
      id: generateId(),
      templateId,
      name,
      fieldValues: values,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    set((state) => ({ documents: [...state.documents, doc] }));
  },

  updateDocument: (id: string, values: Record<string, string>) => {
    set((state) => ({
      documents: state.documents.map((d) =>
        d.id === id ? { ...d, fieldValues: { ...d.fieldValues, ...values }, updatedAt: new Date() } : d
      ),
    }));
  },

  removeDocument: (id: string) => {
    set((state) => ({
      documents: state.documents.filter((d) => d.id !== id),
    }));
  },

  batchUpdateField: (templateId: string, fieldKey: string, value: string) => {
    set((state) => ({
      documents: state.documents.map((d) =>
        d.templateId === templateId
          ? { ...d, fieldValues: { ...d.fieldValues, [fieldKey]: value }, updatedAt: new Date() }
          : d
      ),
    }));
  },

  submitTemplateRequest: async (file: File, submittedBy: string, description: string) => {
    const htmlPreview = await convertDocxToHtml(file);
    const fields = extractFields(htmlPreview);

    const request: TemplateRequest = {
      id: generateId(),
      name: file.name.replace(/\.docx$/i, ''),
      description,
      submittedBy,
      fileName: file.name,
      fileSize: file.size,
      submittedAt: new Date(),
      status: 'pending',
      fields,
      rawFile: file,
      htmlPreview,
    };

    set((state) => ({
      templateRequests: [...state.templateRequests, request],
    }));
  },

  approveRequest: (id: string, comment?: string) => {
    set((state) => {
      const request = state.templateRequests.find((r) => r.id === id);
      if (!request) return state;

      const template: DocumentTemplate = {
        id: generateId(),
        name: request.name,
        fileName: request.fileName,
        fileSize: request.fileSize,
        uploadedAt: new Date(),
        fields: request.fields,
        rawFile: request.rawFile,
        htmlPreview: request.htmlPreview,
      };

      return {
        templates: [...state.templates, template],
        templateRequests: state.templateRequests.map((r) =>
          r.id === id
            ? { ...r, status: 'approved' as const, reviewedAt: new Date(), reviewComment: comment }
            : r
        ),
      };
    });
  },

  rejectRequest: (id: string, comment: string) => {
    set((state) => ({
      templateRequests: state.templateRequests.map((r) =>
        r.id === id
          ? { ...r, status: 'rejected' as const, reviewedAt: new Date(), reviewComment: comment }
          : r
      ),
    }));
  },

  removeRequest: (id: string) => {
    set((state) => ({
      templateRequests: state.templateRequests.filter((r) => r.id !== id),
    }));
  },
}));
