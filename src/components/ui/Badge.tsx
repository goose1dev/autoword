import type { ReactNode } from 'react';
import styles from './Badge.module.css';

interface BadgeProps {
  variant?: 'primary' | 'accent' | 'success' | 'warning' | 'danger';
  children: ReactNode;
}

export function Badge({ variant = 'primary', children }: BadgeProps) {
  return (
    <span className={`${styles.badge} ${styles[variant]}`}>
      {children}
    </span>
  );
}
