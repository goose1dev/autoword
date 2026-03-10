import { useState, type ChangeEvent } from 'react';
import { Search, X } from 'lucide-react';
import styles from './Header.module.css';

interface HeaderProps {
  title: string;
  breadcrumb?: string;
  onSearch?: (query: string) => void;
  searchPlaceholder?: string;
}

export function Header({ title, breadcrumb, onSearch, searchPlaceholder }: HeaderProps) {
  const [query, setQuery] = useState('');
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    onSearch?.(value);
  };

  const closeMobileSearch = () => {
    setMobileSearchOpen(false);
    setQuery('');
    onSearch?.('');
  };

  return (
    <header className={styles.header}>
      <div className={styles.left}>
        <h1 className={styles.pageTitle}>{title}</h1>
        {breadcrumb && <span className={styles.breadcrumb}>{breadcrumb}</span>}
      </div>
      <div className={styles.right}>
        {onSearch && (
          <>
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
            <button
              className={styles.mobileSearchBtn}
              onClick={() => setMobileSearchOpen(true)}
              aria-label="Пошук"
            >
              <Search size={18} />
            </button>
          </>
        )}
      </div>
      {onSearch && mobileSearchOpen && (
        <div className={styles.mobileSearchOverlay}>
          <div className={styles.mobileSearchBox}>
            <Search size={16} className={styles.searchIcon} />
            <input
              type="text"
              placeholder={searchPlaceholder ?? 'Пошук...'}
              value={query}
              onChange={handleChange}
              className={styles.searchInput}
              autoFocus
            />
            <button className={styles.mobileSearchClose} onClick={closeMobileSearch}>
              <X size={18} />
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
