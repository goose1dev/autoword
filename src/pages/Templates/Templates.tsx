import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText, Trash2, Eye, PenTool, Plus, Clock, CheckCircle,
  XCircle, Send, MessageSquare, User, ChevronDown,
} from 'lucide-react';
import { GlassCard, Button, Badge, FileDropZone, Modal, Input } from '@/components/ui/index.ts';
import { Header } from '@/components/layout/Header.tsx';
import { useDocumentStore } from '@/store/useDocumentStore.ts';
import { useSettingsStore } from '@/store/useSettingsStore.ts';
import { useAuthStore } from '@/store/useAuthStore.ts';
import type { TemplateRequestStatus } from '@/types/index.ts';
import styles from './Templates.module.css';

type TabId = 'templates' | 'requests';

const STATUS_CONFIG: Record<TemplateRequestStatus, { label: string; variant: 'warning' | 'success' | 'danger'; icon: typeof Clock }> = {
  pending:  { label: 'Очікує',     variant: 'warning', icon: Clock },
  approved: { label: 'Затверджено', variant: 'success', icon: CheckCircle },
  rejected: { label: 'Відхилено',  variant: 'danger',  icon: XCircle },
};

export function Templates() {
  const navigate = useNavigate();
  const currentUser = useAuthStore((s) => s.currentUser);
  const isAdmin = currentUser?.role === 'admin';

  const templates = useDocumentStore((s) => s.templates);
  const addTemplate = useDocumentStore((s) => s.addTemplate);
  const removeTemplate = useDocumentStore((s) => s.removeTemplate);
  const setActiveTemplate = useDocumentStore((s) => s.setActiveTemplate);
  const templateRequests = useDocumentStore((s) => s.templateRequests);
  const submitTemplateRequest = useDocumentStore((s) => s.submitTemplateRequest);
  const approveRequest = useDocumentStore((s) => s.approveRequest);
  const rejectRequest = useDocumentStore((s) => s.rejectRequest);
  const removeRequest = useDocumentStore((s) => s.removeRequest);
  const darkPreview = useSettingsStore((s) => s.darkPreview);

  const [activeTab, setActiveTab] = useState<TabId>('templates');
  const [showUpload, setShowUpload] = useState(false);
  const [showSubmitRequest, setShowSubmitRequest] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);

  // Submit request form state
  const [requestFile, setRequestFile] = useState<File | null>(null);
  const [requestDesc, setRequestDesc] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Review modal state
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewPreviewId, setReviewPreviewId] = useState<string | null>(null);

  // Filter state for requests
  const [statusFilter, setStatusFilter] = useState<TemplateRequestStatus | 'all'>('all');

  const previewTemplate = templates.find((t) => t.id === previewId);
  const reviewRequest = templateRequests.find((r) => r.id === reviewId);
  const reviewPreview = templateRequests.find((r) => r.id === reviewPreviewId);

  const userRequests = isAdmin
    ? templateRequests
    : templateRequests.filter((r) => r.submittedByUid === currentUser?.id);

  const pendingCount = userRequests.filter((r) => r.status === 'pending').length;

  const filteredRequests = statusFilter === 'all'
    ? userRequests
    : userRequests.filter((r) => r.status === statusFilter);

  const handleFiles = async (files: File[]) => {
    for (const file of files) {
      await addTemplate(file);
    }
    setShowUpload(false);
  };

  const handleEdit = (id: string) => {
    setActiveTemplate(id);
    navigate('/editor');
  };

  const handleSubmitRequest = async () => {
    if (!requestFile) return;
    setSubmitting(true);
    await submitTemplateRequest(requestFile, currentUser?.displayName ?? 'Невідомий', requestDesc.trim(), currentUser?.id ?? '');
    setSubmitting(false);
    setRequestFile(null);
    setRequestDesc('');
    setShowSubmitRequest(false);
  };

  const handleApprove = () => {
    if (!reviewId) return;
    approveRequest(reviewId, reviewComment || undefined);
    setReviewId(null);
    setReviewComment('');
  };

  const handleReject = () => {
    if (!reviewId || !reviewComment.trim()) return;
    rejectRequest(reviewId, reviewComment.trim());
    setReviewId(null);
    setReviewComment('');
  };

  return (
    <>
      <Header title="Шаблони" breadcrumb="Управління шаблонами документів" />
      <div className={styles.page}>
        {/* ── Tabs ── */}
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${activeTab === 'templates' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('templates')}
          >
            <FileText size={16} />
            Шаблони
            {templates.length > 0 && (
              <span className={styles.tabCount}>{templates.length}</span>
            )}
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'requests' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('requests')}
          >
            <Send size={16} />
            Запити
            {pendingCount > 0 && (
              <span className={styles.tabCountPending}>{pendingCount}</span>
            )}
          </button>
        </div>

        {/* ════════════════════════════════════════════ */}
        {/* ── Tab: Templates ── */}
        {/* ════════════════════════════════════════════ */}
        {activeTab === 'templates' && (
          <>
            <div className={styles.topBar}>
              <div />
              <div className={styles.topBarActions}>
                <Button
                  variant="secondary"
                  icon={<Send size={16} />}
                  onClick={() => setShowSubmitRequest(true)}
                >
                  Надіслати запит
                </Button>
                {isAdmin && (
                  <Button
                    variant="primary"
                    icon={<Plus size={16} />}
                    onClick={() => setShowUpload(true)}
                  >
                    Завантажити
                  </Button>
                )}
              </div>
            </div>

            {showUpload && (
              <div className={styles.uploadSection}>
                <GlassCard padding="lg">
                  <FileDropZone onFiles={handleFiles} />
                </GlassCard>
              </div>
            )}

            <motion.div className={styles.grid} layout>
              <AnimatePresence>
                {templates.map((template) => (
                  <motion.div
                    key={template.id}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                  >
                    <GlassCard interactive padding="md">
                      <div className={styles.card}>
                        <div className={styles.cardHeader}>
                          <div className={styles.cardIcon}>
                            <FileText size={22} />
                          </div>
                          <Badge variant="accent">
                            {template.fields.length} полів
                          </Badge>
                        </div>

                        <div>
                          <div className={styles.cardName}>{template.name}</div>
                          <div className={styles.cardMeta}>
                            {template.fileName} &middot;{' '}
                            {(template.fileSize / 1024).toFixed(1)} KB
                          </div>
                        </div>

                        <div className={styles.cardFieldsList}>
                          {template.fields.slice(0, 5).map((f) => (
                            <Badge key={f.id} variant="primary">{f.key}</Badge>
                          ))}
                          {template.fields.length > 5 && (
                            <Badge variant="warning">
                              +{template.fields.length - 5}
                            </Badge>
                          )}
                        </div>

                        <div className={styles.cardActions}>
                          <Button
                            variant="secondary"
                            size="sm"
                            icon={<Eye size={14} />}
                            onClick={() => setPreviewId(template.id)}
                          >
                            Перегляд
                          </Button>
                          {isAdmin && (
                            <Button
                              variant="primary"
                              size="sm"
                              icon={<PenTool size={14} />}
                              onClick={() => handleEdit(template.id)}
                            >
                              Редагувати
                            </Button>
                          )}
                          {isAdmin && (
                            <Button
                              variant="danger"
                              size="sm"
                              icon={<Trash2 size={14} />}
                              iconOnly
                              onClick={() => removeTemplate(template.id)}
                              aria-label="Видалити"
                            />
                          )}
                        </div>
                      </div>
                    </GlassCard>
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>

            {templates.length === 0 && !showUpload && (
              <GlassCard padding="lg">
                <div style={{ textAlign: 'center', padding: '3rem 2rem' }}>
                  <FileText size={48} style={{ opacity: 0.2, marginBottom: 16 }} />
                  <p style={{ fontWeight: 500, marginBottom: 8 }}>
                    Ще немає шаблонів
                  </p>
                  <p style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--font-size-sm)', marginBottom: 20 }}>
                    Завантажте .docx файл або надішліть запит на додавання шаблону
                  </p>
                  <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                    {isAdmin && (
                      <Button variant="primary" onClick={() => setShowUpload(true)}>
                        Завантажити шаблон
                      </Button>
                    )}
                    <Button variant="secondary" icon={<Send size={16} />} onClick={() => setShowSubmitRequest(true)}>
                      Надіслати запит
                    </Button>
                  </div>
                </div>
              </GlassCard>
            )}
          </>
        )}

        {/* ════════════════════════════════════════════ */}
        {/* ── Tab: Requests ── */}
        {/* ════════════════════════════════════════════ */}
        {activeTab === 'requests' && (
          <>
            <div className={styles.topBar}>
              <div className={styles.filterBar}>
                {(['all', 'pending', 'approved', 'rejected'] as const).map((f) => (
                  <button
                    key={f}
                    className={`${styles.filterBtn} ${statusFilter === f ? styles.filterBtnActive : ''}`}
                    onClick={() => setStatusFilter(f)}
                  >
                    {f === 'all' ? 'Всі' : STATUS_CONFIG[f].label}
                    {f === 'pending' && pendingCount > 0 && (
                      <span className={styles.filterCount}>{pendingCount}</span>
                    )}
                  </button>
                ))}
              </div>
              <Button
                variant="primary"
                icon={<Send size={16} />}
                onClick={() => setShowSubmitRequest(true)}
              >
                Новий запит
              </Button>
            </div>

            <motion.div className={styles.grid} layout>
              <AnimatePresence>
                {filteredRequests.map((req) => {
                  const cfg = STATUS_CONFIG[req.status];
                  const StatusIcon = cfg.icon;
                  return (
                    <motion.div
                      key={req.id}
                      layout
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                    >
                      <GlassCard interactive padding="md">
                        <div className={styles.card}>
                          <div className={styles.cardHeader}>
                            <div className={`${styles.cardIcon} ${styles[`cardIcon_${req.status}`]}`}>
                              <StatusIcon size={22} />
                            </div>
                            <Badge variant={cfg.variant}>{cfg.label}</Badge>
                          </div>

                          <div>
                            <div className={styles.cardName}>{req.name}</div>
                            <div className={styles.cardMeta}>
                              <User size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
                              {req.submittedBy} &middot;{' '}
                              {new Date(req.submittedAt).toLocaleDateString('uk-UA')}
                            </div>
                            {req.description && (
                              <div className={styles.cardDesc}>{req.description}</div>
                            )}
                          </div>

                          <div className={styles.cardMeta}>
                            {req.fileName} &middot; {(req.fileSize / 1024).toFixed(1)} KB
                            &middot; {req.fields.length} полів
                          </div>

                          {req.reviewComment && (
                            <div className={styles.reviewComment}>
                              <MessageSquare size={14} />
                              <span>{req.reviewComment}</span>
                            </div>
                          )}

                          <div className={styles.cardActions}>
                            <Button
                              variant="secondary"
                              size="sm"
                              icon={<Eye size={14} />}
                              onClick={() => setReviewPreviewId(req.id)}
                            >
                              Перегляд
                            </Button>
                            {isAdmin && req.status === 'pending' && (
                              <Button
                                variant="primary"
                                size="sm"
                                icon={<ChevronDown size={14} />}
                                onClick={() => { setReviewId(req.id); setReviewComment(''); }}
                              >
                                Розглянути
                              </Button>
                            )}
                            {isAdmin && (
                              <Button
                                variant="danger"
                                size="sm"
                                icon={<Trash2 size={14} />}
                                iconOnly
                                onClick={() => removeRequest(req.id)}
                                aria-label="Видалити"
                              />
                            )}
                          </div>
                        </div>
                      </GlassCard>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </motion.div>

            {filteredRequests.length === 0 && (
              <GlassCard padding="lg">
                <div style={{ textAlign: 'center', padding: '3rem 2rem' }}>
                  <Send size={48} style={{ opacity: 0.2, marginBottom: 16 }} />
                  <p style={{ fontWeight: 500, marginBottom: 8 }}>
                    {statusFilter === 'all' ? 'Немає запитів' : `Немає запитів зі статусом "${STATUS_CONFIG[statusFilter].label}"`}
                  </p>
                  <p style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--font-size-sm)', marginBottom: 20 }}>
                    Надішліть запит на додавання нового шаблону
                  </p>
                  <Button variant="primary" icon={<Send size={16} />} onClick={() => setShowSubmitRequest(true)}>
                    Створити запит
                  </Button>
                </div>
              </GlassCard>
            )}
          </>
        )}
      </div>

      {/* ── Preview Modal (approved templates) ── */}
      <Modal
        open={!!previewId}
        onClose={() => setPreviewId(null)}
        title={previewTemplate?.name ?? 'Перегляд'}
      >
        {previewTemplate && (
          <div
            style={{
              background: darkPreview ? '#1a1a2e' : '#fff',
              color: darkPreview ? '#e0e0e8' : '#000',
              padding: '24px',
              borderRadius: 'var(--radius-md)', maxHeight: '60vh',
              overflow: 'auto', fontSize: '14px', lineHeight: '1.6',
            }}
            dangerouslySetInnerHTML={{ __html: previewTemplate.htmlPreview }}
          />
        )}
      </Modal>

      {/* ── Preview Modal (request) ── */}
      <Modal
        open={!!reviewPreviewId}
        onClose={() => setReviewPreviewId(null)}
        title={reviewPreview?.name ?? 'Перегляд запиту'}
      >
        {reviewPreview && (
          <>
            <div className={styles.requestMeta}>
              <span><User size={14} /> {reviewPreview.submittedBy}</span>
              <Badge variant={STATUS_CONFIG[reviewPreview.status].variant}>
                {STATUS_CONFIG[reviewPreview.status].label}
              </Badge>
              <span>{new Date(reviewPreview.submittedAt).toLocaleDateString('uk-UA')}</span>
            </div>
            {reviewPreview.description && (
              <p style={{ color: 'var(--color-text-secondary)', marginBottom: 16, fontSize: 'var(--font-size-sm)' }}>
                {reviewPreview.description}
              </p>
            )}
            <div
              style={{
                background: darkPreview ? '#1a1a2e' : '#fff',
                color: darkPreview ? '#e0e0e8' : '#000',
                padding: '24px',
                borderRadius: 'var(--radius-md)', maxHeight: '50vh',
                overflow: 'auto', fontSize: '14px', lineHeight: '1.6',
              }}
              dangerouslySetInnerHTML={{ __html: reviewPreview.htmlPreview }}
            />
          </>
        )}
      </Modal>

      {/* ── Submit Request Modal ── */}
      <Modal
        open={showSubmitRequest}
        onClose={() => { setShowSubmitRequest(false); setRequestFile(null); setRequestDesc(''); }}
        title="Надіслати запит на шаблон"
        footer={
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <Button variant="secondary" onClick={() => { setShowSubmitRequest(false); setRequestFile(null); setRequestDesc(''); }}>
              Скасувати
            </Button>
            <Button
              variant="primary"
              icon={<Send size={16} />}
              onClick={handleSubmitRequest}
              disabled={!requestFile || submitting}
            >
              {submitting ? 'Надсилаю...' : 'Надіслати'}
            </Button>
          </div>
        }
      >
        <div className={styles.formGroup}>
          <div className={styles.formLabel}>Від імені</div>
          <div className={styles.fileChip}>
            <User size={16} />
            <span>{currentUser?.displayName ?? currentUser?.username}</span>
          </div>
        </div>
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Опис шаблону</label>
          <textarea
            className={styles.formTextarea}
            rows={3}
            value={requestDesc}
            onChange={(e) => setRequestDesc(e.target.value)}
            placeholder="Для чого цей шаблон, які поля містить..."
          />
        </div>
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Файл шаблону (.docx)</label>
          {requestFile ? (
            <div className={styles.fileChip}>
              <FileText size={16} />
              <span>{requestFile.name}</span>
              <button onClick={() => setRequestFile(null)} className={styles.fileChipRemove}>&times;</button>
            </div>
          ) : (
            <FileDropZone
              onFiles={(files) => { if (files[0]) setRequestFile(files[0]); }}
            />
          )}
        </div>
      </Modal>

      {/* ── Review Modal (approve / reject) ── */}
      <Modal
        open={!!reviewId}
        onClose={() => { setReviewId(null); setReviewComment(''); }}
        title={`Розгляд: ${reviewRequest?.name ?? ''}`}
        footer={
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <Button
              variant="danger"
              icon={<XCircle size={16} />}
              onClick={handleReject}
              disabled={!reviewComment.trim()}
            >
              Відхилити
            </Button>
            <Button
              variant="primary"
              icon={<CheckCircle size={16} />}
              onClick={handleApprove}
            >
              Затвердити
            </Button>
          </div>
        }
      >
        {reviewRequest && (
          <>
            <div className={styles.requestMeta}>
              <span><User size={14} /> {reviewRequest.submittedBy}</span>
              <span>{new Date(reviewRequest.submittedAt).toLocaleDateString('uk-UA')}</span>
              <span>{reviewRequest.fileName} &middot; {(reviewRequest.fileSize / 1024).toFixed(1)} KB</span>
            </div>
            {reviewRequest.description && (
              <p style={{ color: 'var(--color-text-secondary)', marginBottom: 16, fontSize: 'var(--font-size-sm)' }}>
                {reviewRequest.description}
              </p>
            )}
            <div className={styles.reviewFields}>
              <span className={styles.formLabel}>Знайдені поля:</span>
              <div className={styles.cardFieldsList}>
                {reviewRequest.fields.map((f) => (
                  <Badge key={f.id} variant="primary">{f.key}</Badge>
                ))}
                {reviewRequest.fields.length === 0 && (
                  <span style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--font-size-sm)' }}>Полів не знайдено</span>
                )}
              </div>
            </div>
            <div className={styles.formGroup} style={{ marginTop: 16 }}>
              <Input
                label="Коментар"
                icon={<MessageSquare size={16} />}
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder="Обов'язково при відхиленні"
              />
            </div>
          </>
        )}
      </Modal>
    </>
  );
}
