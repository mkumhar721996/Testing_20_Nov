import { useState, type ReactNode } from 'react'
import './shell.css'

const SECTIONS = [
  { key: 'overview', label: 'Overview', href: '/' },
  { key: 'items', label: 'Items', href: '/' },
  { key: 'reports', label: 'Reports', href: '/' },
  { key: 'settings', label: 'Settings', href: '/' },
]

/** Every employee screen sits under Items, so that section is the current page. */
const CURRENT_SECTION = 'items'

export default function AppShell({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="shell">
      <header className="shell-header">
        <a className="shell-brand" href="/">
          Comp
        </a>
        <button
          type="button"
          className="btn btn-secondary shell-menu-btn"
          aria-controls="main-nav"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          Menu
        </button>
        <nav id="main-nav" className={`shell-nav${menuOpen ? ' is-open' : ''}`} aria-label="Main" hidden={!menuOpen}>
          <ul>
            {SECTIONS.map((section) => (
              <li key={section.key}>
                <a
                  className="shell-link"
                  href={section.href}
                  data-nav-key={section.key}
                  aria-current={section.key === CURRENT_SECTION ? 'page' : undefined}
                >
                  {section.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <a className="shell-link" href="/" data-nav-key="account">
          Account
        </a>
      </header>
      <div className="shell-layout">
        <main id="content">{children}</main>
      </div>
      <footer className="shell-footer">
        <span>Comp</span>
        <nav aria-label="Footer">
          <ul>
            <li>
              <a href="/">Help</a>
            </li>
            <li>
              <a href="/">Privacy</a>
            </li>
          </ul>
        </nav>
      </footer>
    </div>
  )
}
