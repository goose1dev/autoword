import { useState, type ChangeEvent } from 'react';
import { Search } from 'lucide-react';
import styles from './Header.module.css';

interface HeaderProps {
  title: string;
  breadcrumb?: string;
  onSearch?: (query: string) => void;
  searchPlaceholder?: string;
}

export function Header({ title, breadcrumb, onSearch, searchPlaceholder }: HeaderProps) {
  const [query, setQuery] = useState('');

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    onSearch?.(value);
  };

  return (
    <header className={styles.header}>
      <div className={styles.left}>
        <h1 className={styles.pageTitle}>{title}</h1>
        {breadcrumb && <span className={styles.breadcrumb}>{breadcrumb}</span>}
      </div>
      <div className={styles.right}>
        {onSearch && (
          <div className={styles.searchBox}>
            <Search size={16} className={styles.searchIcon} />
            <input
              type="text"
              placeholder={searchPlaceholder ?? 'Пошук документів...'}
              value={query}
              onChange={handleChange}
              className={styles.searchInput}
            />
          </div>
        )}
      </div>
    </header>
  );
}
