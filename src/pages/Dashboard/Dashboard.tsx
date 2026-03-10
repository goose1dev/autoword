import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  FileText,
  Layers,
  Zap,
  Upload,
  FolderOpen,
  PenTool,
  FileUp,
} from 'lucide-react';
import { GlassCard, Badge, Button } from '@/components/ui/index.ts';
import { Header } from '@/components/layout/Header.tsx';
import { useDocumentStore } from '@/store/useDocumentStore.ts';
import { useBatchStore } from '@/store/useBatchStore.ts';
import styles from './Dashboard.module.css';

const stagger = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

export function Dashboard() {
  const navigate = useNavigate();
  const templates = useDocumentStore((s) => s.templates);
  const documents = useDocumentStore((s) => s.documents);
  const batchFiles = useBatchStore((s) => s.files);
  const exportedCount = useBatchStore((s) => s.exportedCount);

  const totalFields = templates.reduce((sum, t) => sum + t.fields.length, 0);

  const stats = [
    { icon: FileText, value: templates.length, label: 'Шаблонів', color: 'purple' as const },
    { icon: Layers, value: documents.length + batchFiles.length, label: 'Документів', color: 'teal' as const },
    { icon: Zap, value: totalFields, label: 'Полів', color: 'green' as const },
    { icon: Upload, value: exportedCount, label: 'Експортовано', color: 'orange' as const },
  ];

  const actions = [
    {
      icon: FileUp,
      title: 'Завантажити шаблон',
      desc: 'Додати новий .docx шаблон',
      onClick: () => navigate('/templates'),
    },
    {
      icon: PenTool,
      title: 'Створити документ',
      desc: 'Заповнити шаблон даними',
      onClick: () => navigate('/editor'),
    },
    {
      icon: Layers,
      title: 'Масове редагування',
      desc: 'Змінити поля одразу в багатьох файлах',
      onClick: () => navigate('/batch'),
    },
  ];

  return (
    <>
      <Header title="Головна" />
      <motion.div
        className={styles.page}
        variants={stagger}
        initial="hidden"
        animate="show"
      >
        {/* Hero */}
        <motion.div className={styles.hero} variants={fadeUp}>
          <h1 className={styles.heroTitle}>
            Автоматизуй документи{'\n'}за секунди
          </h1>
          <p className={styles.heroSub}>
            Завантажуй Word-шаблони, заповнюй поля, переглядай та експортуй —
            все в одному місці.
          </p>
        </motion.div>

        {/* Stats */}
        <motion.div className={styles.statsGrid} variants={fadeUp}>
          {stats.map((stat) => (
            <GlassCard key={stat.label} padding="md">
              <div className={styles.statCard}>
                <div className={`${styles.statIcon} ${styles[stat.color]}`}>
                  <stat.icon size={22} />
                </div>
                <div>
                  <div className={styles.statValue}>{stat.value}</div>
                  <div className={styles.statLabel}>{stat.label}</div>
                </div>
              </div>
            </GlassCard>
          ))}
        </motion.div>

        {/* Quick Actions */}
        <motion.div variants={fadeUp}>
          <h2 className={styles.sectionTitle}>Швидкі дії</h2>
          <div className={styles.actionsGrid}>
            {actions.map((action) => (
              <GlassCard
                key={action.title}
                interactive
                padding="md"
                onClick={action.onClick}
                style={{ cursor: 'pointer' }}
              >
                <div className={styles.actionCard}>
                  <div className={styles.actionIcon}>
                    <action.icon size={20} />
                  </div>
                  <div>
                    <div className={styles.actionTitle}>{action.title}</div>
                    <div className={styles.actionDesc}>{action.desc}</div>
                  </div>
                </div>
              </GlassCard>
            ))}
          </div>
        </motion.div>

        {/* Recent Templates */}
        <motion.div variants={fadeUp}>
          <h2 className={styles.sectionTitle}>Останні шаблони</h2>
          {templates.length === 0 ? (
            <GlassCard padding="lg">
              <div className={styles.emptyState}>
                <FolderOpen size={48} className={styles.emptyIcon} />
                <p className={styles.emptyTitle}>Шаблонів поки немає</p>
                <p className={styles.emptyDesc}>
                  Завантажте перший .docx файл у розділі «Шаблони»
                </p>
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => navigate('/templates')}
                  style={{ marginTop: 16 }}
                >
                  Завантажити шаблон
                </Button>
              </div>
            </GlassCard>
          ) : (
            <div className={styles.templatesList}>
              {templates.slice(0, 5).map((template) => (
                <div
                  key={template.id}
                  className={styles.templateRow}
                  onClick={() => {
                    useDocumentStore.getState().setActiveTemplate(template.id);
                    navigate('/editor');
                  }}
                >
                  <div className={styles.templateInfo}>
                    <div className={styles.templateFileIcon}>
                      <FileText size={18} />
                    </div>
                    <div>
                      <div className={styles.templateName}>{template.name}</div>
                      <div className={styles.templateMeta}>
                        {template.fields.length} полів &middot;{' '}
                        {(template.fileSize / 1024).toFixed(1)} KB
                      </div>
                    </div>
                  </div>
                  <div className={styles.templateActions}>
                    <Badge variant="accent">
                      {template.fields.length} полів
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </motion.div>
    </>
  );
}
