import { useState } from 'react'
import type { ReactNode } from 'react'
import './shell.css'

const SECTIONS = [
  { id: 'overview', label: 'Overview' },
  { id: 'items', label: 'Items' },
  { id: 'reports', label: 'Reports' },
  { id: 'settings', label: 'Settings' },
]

export type SectionId = 'overview' | 'items' | 'reports' | 'settings'

// Only Overview and Items exist yet; the other links are inert placeholders.
const NAVIGABLE: SectionId[] = ['overview', 'items']

type Props = { current?: SectionId; onNavigate?: (section: SectionId) => void; children: ReactNode }

export function AppShell({ current = 'overview', onNavigate, children }: Props) {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="shell">
      <header className="shell-header">
        <a className="shell-brand" href="#">
          Comp
        </a>
        <button
          type="button"
          className="btn btn-secondary shell-menu-btn"
          aria-controls="main-nav"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((o) => !o)}
        >
          Menu
        </button>
        <nav
          id="main-nav"
          className={`shell-nav${menuOpen ? ' is-open' : ''}`}
          aria-label="Main"
          hidden={!menuOpen}
        >
          <ul>
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <a
                  className="shell-link"
                  href="#"
                  data-nav-key={s.id}
                  aria-current={s.id === current ? 'page' : undefined}
                  onClick={(e) => {
                    e.preventDefault()
                    if (NAVIGABLE.includes(s.id as SectionId)) {
                      onNavigate?.(s.id as SectionId)
                      setMenuOpen(false)
                    }
                  }}
                >
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <a className="shell-link" href="#" data-nav-key="account">
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
              <a href="#">Help</a>
            </li>
            <li>
              <a href="#">Privacy</a>
            </li>
          </ul>
        </nav>
      </footer>
    </div>
  )
}
