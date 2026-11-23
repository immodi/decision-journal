import { useTheme } from '../hooks/useTheme';

export default function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const next = theme === 'dark' ? 'light' : 'dark';

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${next} mode`}
      className="fixed bottom-5 right-5 z-30 rounded-full border border-line bg-surface/90 px-3.5 py-2 text-xs font-medium text-muted shadow-sm backdrop-blur transition hover:text-ink"
    >
      {next === 'dark' ? 'Dark mode' : 'Light mode'}
    </button>
  );
}
