import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  Layers,
  Settings,
  Zap,
  LogOut,
  Shield,
  User,
} from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore.ts';
import styles from './Sidebar.module.css';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Головна' },
  { to: '/templates', icon: FileText, label: 'Шаблони' },
  { to: '/editor', icon: Zap, label: 'Редактор' },
  { to: '/batch', icon: Layers, label: 'Пакетне' },
  { to: '/settings', icon: Settings, label: 'Налаштування' },
];

export function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const currentUser = useAuthStore((s) => s.currentUser);
  const logout = useAuthStore((s) => s.logout);

  const handleLogout = async () => {
    await logout();
    navigate('/auth', { replace: true });
  };

  const currentLabel = navItems.find(
    (item) => item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to)
  )?.label ?? 'AutoWord';

  return (
    <>
      {/* Desktop sidebar */}
      <aside className={styles.sidebar}>
        <div className={styles.logo}>
          <div className={styles.logoIcon}>
            <Zap size={20} color="#fff" />
          </div>
          <span className={styles.logoText}>AutoWord</span>
        </div>

        <nav className={styles.nav}>
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `${styles.navItem} ${isActive ? styles.active : ''}`
              }
              end={to === '/'}
            >
              <Icon size={18} className={styles.navIcon} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className={styles.divider} />

        {currentUser && (
          <div className={styles.userSection}>
            <div className={styles.userInfo}>
              <div className={styles.userAvatar}>
                {currentUser.role === 'admin' ? <Shield size={16} /> : <User size={16} />}
              </div>
              <div className={styles.userDetails}>
                <span className={styles.userName}>{currentUser.displayName}</span>
                <span className={styles.userRole}>
                  {currentUser.role === 'admin' ? 'Адмін' : 'Користувач'}
                </span>
              </div>
            </div>
            <button onClick={handleLogout} className={styles.logoutBtn} title="Вийти">
              <LogOut size={16} />
            </button>
          </div>
        )}

        <div className={styles.footer}>
          <p className={styles.version}>AutoWord v1.0.0</p>
        </div>
      </aside>

      {/* Mobile floating bottom bar */}
      <nav className={styles.mobileBar}>
        <div className={styles.mobileBarInner}>
          <span className={styles.mobileBarLabel}>{currentLabel}</span>
          <div className={styles.mobileBarNav}>
            {navItems.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `${styles.mobileNavItem} ${isActive ? styles.mobileNavActive : ''}`
                }
                end={to === '/'}
                title={label}
              >
                <Icon size={20} />
              </NavLink>
            ))}
          </div>
        </div>
      </nav>
    </>
  );
}
