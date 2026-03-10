import type { ReactNode, CSSProperties, MouseEventHandler } from 'react';
import { motion } from 'framer-motion';
import styles from './GlassCard.module.css';

interface GlassCardProps {
  children: ReactNode;
  interactive?: boolean;
  padding?: 'sm' | 'md' | 'lg';
  className?: string;
  style?: CSSProperties;
  onClick?: MouseEventHandler<HTMLDivElement>;
}

export function GlassCard({
  children,
  interactive = false,
  padding = 'md',
  className = '',
  style,
  onClick,
}: GlassCardProps) {
  const classes = [
    styles.glassCard,
    interactive && styles.interactive,
    styles[`padding-${padding}`],
    className,
  ].filter(Boolean).join(' ');

  return (
    <motion.div
      className={classes}
      style={style}
      onClick={onClick}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
    >
      {children}
    </motion.div>
  );
}
