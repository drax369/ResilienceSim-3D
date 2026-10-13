import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import './ThemeToggle.css';

interface ThemeToggleProps {
  className?: string;
  showText?: boolean;
}

export function ThemeToggle({ className = '', showText = false }: ThemeToggleProps) {
  const { isDark, toggleTheme } = useTheme();

  const label = isDark ? 'Switch to light mode' : 'Switch to dark mode';

  return (
    <button
      type="button"
      className={`theme-toggle-btn ${isDark ? 'dark' : 'light'} ${className}`}
      onClick={toggleTheme}
      aria-label={label}
      title={label}
    >
      <span className="theme-toggle-icon-wrap" aria-hidden="true">
        {isDark ? (
          <Sun size={17} className="theme-icon icon-sun" />
        ) : (
          <Moon size={17} className="theme-icon icon-moon" />
        )}
      </span>
      {showText && (
        <span className="theme-toggle-label">{isDark ? 'Light' : 'Dark'}</span>
      )}
    </button>
  );
}
