import { useEffect } from 'react';
import { Link, NavLink, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { DecisionsProvider, useDecisions } from './hooks/useDecisions';
import { isOverdue, sortByReviewDate } from './lib/decisions';
import { buttonPrimarySmall } from './components/ui';
import { navLink } from './components/navLink';
import ThemeToggle from './components/ThemeToggle';
import SignIn from './pages/SignIn';
import Home from './pages/Home';
import NewDecision from './pages/NewDecision';
import DecisionDetail from './pages/DecisionDetail';
import Review from './pages/Review';
import Insights from './pages/Insights';
import Settings from './pages/Settings';

const links: Array<{ to: string; label: string; end?: boolean }> = [
  { to: '/', label: 'Home', end: true },
  { to: '/insights', label: 'Insights' },
  { to: '/settings', label: 'Settings' },
];

function Layout() {
  const { decisions } = useDecisions();
  const dueCount = sortByReviewDate(decisions.filter(isOverdue)).length;

  // Due count in the tab title, as the spec asks for the web client.
  useEffect(() => {
    document.title = dueCount ? `(${dueCount}) Decision Journal` : 'Decision Journal';
  }, [dueCount]);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-line bg-paper/85 backdrop-blur">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-3 px-5 py-3">
          <Link to="/" className="flex items-center gap-2.5 text-ink hover:no-underline">
            <img src="/icon.svg" alt="" className="h-8 w-8 rounded-lg shadow-sm" />
            <span className="text-[15px] font-semibold tracking-tight">Decision Journal</span>
          </Link>

          <nav className="ml-auto flex items-center gap-1 text-sm">
            {links.map((link) => (
              <NavLink key={link.to} to={link.to} end={link.end} className={navLink}>
                {link.label}
              </NavLink>
            ))}
          </nav>

          {dueCount > 0 && (
            <span className="rounded-full bg-warn-soft px-2.5 py-1 text-xs font-semibold text-warn">
              {dueCount} due
            </span>
          )}

          <Link to="/new" className={`${buttonPrimarySmall} shrink-0`}>
            New decision
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-5 pb-24 pt-8">
        <Outlet />
      </main>
    </div>
  );
}

export default function App() {
  const { user, ready } = useAuth();

  return (
    <>
      {!ready ? (
        <p className="pt-24 text-center text-sm text-muted">Loading…</p>
      ) : user ? (
        <DecisionsProvider uid={user.uid}>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<Home />} />
              <Route path="new" element={<NewDecision />} />
              <Route path="decisions/:id" element={<DecisionDetail />} />
              <Route path="decisions/:id/review" element={<Review />} />
              <Route path="insights" element={<Insights />} />
              <Route path="settings" element={<Settings />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </DecisionsProvider>
      ) : (
        <SignIn />
      )}
      <ThemeToggle />
    </>
  );
}
