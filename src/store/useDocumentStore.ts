import { create } from 'zustand';
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase.ts';
import type { DocumentTemplate, DocumentInstance, TemplateRequest } from '@/types/index.ts';
import {
  convertDocxToHtml,
  extractFields,
  generateId,
} from '@/services/documentService.ts';
import { storage } from '@/lib/firebase.ts';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';

function base64ToFile(base64: string, fileName: string): File {
  const [meta, data] = base64.split(',');
  const mime = meta.match(/:(.*?);/)?.[1] ?? 'application/octet-stream';
  const binary = atob(data);
  const array = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) array[i] = binary.charCodeAt(i);
  return new File([array], fileName, { type: mime });
}

async function uploadDocxFile(folder: string, file: File): Promise<{ fileUrl: string; storagePath: string }> {
  const safeName = file.name.replace(/[^\w.\-()[\] ]+/g, '_');
  const storagePath = `${folder}/${crypto.randomUUID()}-${safeName}`;
  const fileRef = ref(storage, storagePath);
  await uploadBytes(fileRef, file, {
    contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
  const fileUrl = await getDownloadURL(fileRef);
  return { fileUrl, storagePath };
}

interface DocumentStore {
  templates: DocumentTemplate[];
  documents: DocumentInstance[];
  activeTemplateId: string | null;
  templateRequests: TemplateRequest[];

  subscribeToFirestore: () => () => void;

  addTemplate: (file: File) => Promise<void>;
  removeTemplate: (id: string) => Promise<void>;
  setActiveTemplate: (id: string | null) => void;

  submitTemplateRequest: (file: File, submittedBy: string, description: string, submittedByUid: string) => Promise<void>;
  approveRequest: (id: string, comment?: string) => Promise<void>;
  rejectRequest: (id: string, comment: string) => Promise<void>;
  removeRequest: (id: string) => Promise<void>;

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

  subscribeToFirestore: () => {
    const unsub1 = onSnapshot(collection(db, 'templates'), (snap) => {
      const templates = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          name: data.name,
          fileName: data.fileName,
          fileSize: data.fileSize,
          uploadedAt: data.uploadedAt?.toDate?.() ?? new Date(),
          fields: data.fields ?? [],
          rawFile: data.fileBase64
            ? base64ToFile(data.fileBase64, data.fileName)
            : new File([], data.fileName),
          fileUrl: data.fileUrl,
          storagePath: data.storagePath,
          htmlPreview: data.htmlPreview ?? '',
        } as DocumentTemplate;
      });
      set({ templates });
    });

    const unsub2 = onSnapshot(collection(db, 'templateRequests'), (snap) => {
      const templateRequests = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          name: data.name,
          description: data.description ?? '',
          submittedBy: data.submittedBy,
          submittedByUid: data.submittedByUid ?? '',
          fileName: data.fileName,
          fileSize: data.fileSize,
          submittedAt: data.submittedAt?.toDate?.() ?? new Date(),
          status: data.status,
          reviewedAt: data.reviewedAt?.toDate?.(),
          reviewComment: data.reviewComment,
          fields: data.fields ?? [],
          rawFile: data.fileBase64
            ? base64ToFile(data.fileBase64, data.fileName)
            : new File([], data.fileName),
          fileUrl: data.fileUrl,
          storagePath: data.storagePath,
          htmlPreview: data.htmlPreview ?? '',
        } as TemplateRequest;
      });
      set({ templateRequests });
    });

    return () => {
      unsub1();
      unsub2();
    };
  },

  addTemplate: async (file: File) => {
    const htmlPreview = await convertDocxToHtml(file);
    const fields = extractFields(htmlPreview);
    const uploaded = await uploadDocxFile('templates', file);

    await addDoc(collection(db, 'templates'), {
      name: file.name.replace(/\.docx$/i, ''),
      fileName: file.name,
      fileSize: file.size,
      uploadedAt: serverTimestamp(),
      fields,
      ...uploaded,
      htmlPreview,
    });
  },

  removeTemplate: async (id: string) => {
    await deleteDoc(doc(db, 'templates', id));
    set((state) => ({
      documents: state.documents.filter((d) => d.templateId !== id),
      activeTemplateId: state.activeTemplateId === id ? null : state.activeTemplateId,
    }));
  },

  setActiveTemplate: (id: string | null) => {
    set({ activeTemplateId: id });
  },

  submitTemplateRequest: async (file: File, submittedBy: string, description: string, submittedByUid: string) => {
    const htmlPreview = await convertDocxToHtml(file);
    const fields = extractFields(htmlPreview);
    const uploaded = await uploadDocxFile('template-requests', file);

    await addDoc(collection(db, 'templateRequests'), {
      name: file.name.replace(/\.docx$/i, ''),
      description,
      submittedBy,
      submittedByUid,
      fileName: file.name,
      fileSize: file.size,
      submittedAt: serverTimestamp(),
      status: 'pending',
      fields,
      ...uploaded,
      htmlPreview,
    });
  },

  approveRequest: async (id: string, comment?: string) => {
    const reqDoc = await getDoc(doc(db, 'templateRequests', id));
    if (!reqDoc.exists()) return;
    const reqData = reqDoc.data();

    const templatePayload: Record<string, unknown> = {
      name: reqData.name,
      fileName: reqData.fileName,
      fileSize: reqData.fileSize,
      uploadedAt: serverTimestamp(),
      fields: reqData.fields,
      fileUrl: reqData.fileUrl,
      storagePath: reqData.storagePath,
      htmlPreview: reqData.htmlPreview,
    };

    if (reqData.fileBase64) {
      templatePayload.fileBase64 = reqData.fileBase64;
    }

    await addDoc(collection(db, 'templates'), templatePayload);

    await updateDoc(doc(db, 'templateRequests', id), {
      status: 'approved',
      reviewedAt: serverTimestamp(),
      reviewComment: comment ?? null,
    });
  },

  rejectRequest: async (id: string, comment: string) => {
    await updateDoc(doc(db, 'templateRequests', id), {
      status: 'rejected',
      reviewedAt: serverTimestamp(),
      reviewComment: comment,
    });
  },

  removeRequest: async (id: string) => {
    await deleteDoc(doc(db, 'templateRequests', id));
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
}));
