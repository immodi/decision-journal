export const navLink = ({ isActive }: { isActive: boolean }): string => (
  isActive
    ? 'rounded-full bg-accent-soft px-3 py-1.5 font-medium text-accent'
    : 'rounded-full px-3 py-1.5 text-muted transition hover:text-ink'
);
