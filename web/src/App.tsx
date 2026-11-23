import { useEffect } from 'react';
import { Link, NavLink, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { DecisionsProvider, useDecisions } from './hooks/useDecisions';
import { isOverdue, sortByReviewDate } from './lib/decisions';
import ThemeToggle from './components/ThemeToggle';
import SignIn from './pages/SignIn';
import Home from './pages/Home';
import NewDecision from './pages/NewDecision';
import DecisionDetail from './pages/DecisionDetail';
import Review from './pages/Review';
import Insights from './pages/Insights';
import Settings from './pages/Settings';

function Layout() {
  const { decisions } = useDecisions();
  const dueCount = sortByReviewDate(decisions.filter(isOverdue)).length;

  // Due count in the tab title, as the spec asks for the web client.
  useEffect(() => {
    document.title = dueCount ? `(${dueCount}) Decision Journal` : 'Decision Journal';
  }, [dueCount]);

  return (
    <>
      <header className="app-header">
        <Link to="/" className="brand">Decision Journal</Link>
        <nav className="app-nav">
          <NavLink to="/" end>Home</NavLink>
          <NavLink to="/insights">Insights</NavLink>
          <NavLink to="/settings">Settings</NavLink>
        </nav>
        {dueCount > 0 && <span className="due-badge">{dueCount} due</span>}
        <Link to="/new" className="button primary">New decision</Link>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
    </>
  );
}

export default function App() {
  const { user, ready } = useAuth();

  return (
    <>
      {!ready ? (
        <p className="centre muted">Loading…</p>
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
