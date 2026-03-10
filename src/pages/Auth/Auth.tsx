import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, LogIn, UserPlus, User, Lock, Type } from 'lucide-react';
import { Button, Input } from '@/components/ui/index.ts';
import { useAuthStore } from '@/store/useAuthStore.ts';
import styles from './Auth.module.css';

type AuthMode = 'login' | 'register';

export function Auth() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const register = useAuthStore((s) => s.register);

  const [mode, setMode] = useState<AuthMode>('login');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (mode === 'login') {
      const result = login(username, password);
      if (result.ok) {
        navigate('/', { replace: true });
      } else {
        setError(result.error ?? 'Помилка входу');
      }
    } else {
      const result = register(username, displayName, password);
      if (result.ok) {
        navigate('/', { replace: true });
      } else {
        setError(result.error ?? 'Помилка реєстрації');
      }
    }
  };

  const switchMode = () => {
    setMode(mode === 'login' ? 'register' : 'login');
    setError('');
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logo}>
          <div className={styles.logoIcon}>
            <Zap size={28} color="#fff" />
          </div>
          <h1 className={styles.logoText}>AutoWord</h1>
        </div>

        <h2 className={styles.title}>
          {mode === 'login' ? 'Вхід' : 'Реєстрація'}
        </h2>
        <p className={styles.subtitle}>
          {mode === 'login'
            ? 'Увійдіть, щоб продовжити роботу'
            : 'Створіть акаунт для доступу до системи'}
        </p>

        <form onSubmit={handleSubmit} className={styles.form}>
          <Input
            label="Ім'я користувача"
            icon={<User size={16} />}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="username"
            autoComplete="username"
            required
          />

          {mode === 'register' && (
            <Input
              label="Відображуване ім'я"
              icon={<Type size={16} />}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Олександр Петренко"
            />
          )}

          <Input
            label="Пароль"
            icon={<Lock size={16} />}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            required
          />

          {error && <div className={styles.error}>{error}</div>}

          <Button
            variant="primary"
            size="lg"
            type="submit"
            icon={mode === 'login' ? <LogIn size={18} /> : <UserPlus size={18} />}
            className={styles.submitBtn}
          >
            {mode === 'login' ? 'Увійти' : 'Зареєструватися'}
          </Button>
        </form>

        <div className={styles.switchRow}>
          <span>
            {mode === 'login' ? 'Немає акаунту?' : 'Вже є акаунт?'}
          </span>
          <button type="button" onClick={switchMode} className={styles.switchBtn}>
            {mode === 'login' ? 'Зареєструватися' : 'Увійти'}
          </button>
        </div>

      </div>
    </div>
  );
}
