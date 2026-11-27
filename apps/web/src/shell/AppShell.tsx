import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import './shell.css'

export const ITEMS_ROOT = '/employees/me'

type Section = 'overview' | 'items' | 'reports' | 'settings'

const SECTIONS: { id: Section; label: string; to: string }[] = [
  { id: 'overview', label: 'Overview', to: '/' },
  { id: 'items', label: 'Items', to: ITEMS_ROOT },
  { id: 'reports', label: 'Reports', to: '/reports' },
  { id: 'settings', label: 'Settings', to: '/settings' },
]

/** Top bar, one centered content column and a footer. `section` marks the current page. */
export default function AppShell({ section, children }: { section: Section; children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false)
  return (
    <div className="shell">
      <header className="shell-header">
        <Link className="shell-brand" to="/">
          Comp
        </Link>
        <button
          type="button"
          className="btn btn-secondary shell-menu-btn"
          aria-controls="main-nav"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          Menu
        </button>
        <nav id="main-nav" className={`shell-nav${menuOpen ? ' is-open' : ''}`} aria-label="Main">
          <ul>
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <Link
                  className="shell-link"
                  to={s.to}
                  data-nav-key={s.id}
                  aria-current={s.id === section ? 'page' : undefined}
                >
                  {s.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <Link className="shell-link" to="/account" data-nav-key="account">
          Account
        </Link>
      </header>
      <div className="shell-layout">
        <main id="content">{children}</main>
      </div>
      <footer className="shell-footer">
        <span>Comp</span>
        <nav aria-label="Footer">
          <ul>
            <li>
              <a href="/help">Help</a>
            </li>
            <li>
              <a href="/privacy">Privacy</a>
            </li>
          </ul>
        </nav>
      </footer>
    </div>
  )
}
