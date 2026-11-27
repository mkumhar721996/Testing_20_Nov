import { useState } from 'react'
import { AppShell } from './components/AppShell'
import type { SectionId } from './components/AppShell'
import { DashboardPage } from './features/dashboard/DashboardPage'
import { EmployeeProfile } from './features/employment/EmployeeProfile'
import { EmploymentHistory } from './features/employment/EmploymentHistory'

type View = 'profile' | 'history'

// No employee directory exists yet (a separate story), so the employee comes from ?employee=<id>.
const employeeIdFromUrl = () => new URLSearchParams(window.location.search).get('employee')

function ItemsSection() {
  const employeeId = employeeIdFromUrl()
  const [view, setView] = useState<View>('profile')
  // Bumped to remount the profile so its drawer opens from the history empty state.
  const [openDrawer, setOpenDrawer] = useState(0)

  if (!employeeId) {
    return (
      <div className="empty-state">
        <h3>Choose an employee</h3>
        <p className="text-muted">
          Open an employee to see their job, department and manager. The employee directory is a
          separate story.
        </p>
      </div>
    )
  }
  if (view === 'history') {
    return (
      <EmploymentHistory
        employeeId={employeeId}
        onBack={() => setView('profile')}
        onChange={() => {
          setOpenDrawer((n) => n + 1)
          setView('profile')
        }}
      />
    )
  }
  return (
    <EmployeeProfile
      key={openDrawer}
      employeeId={employeeId}
      openDrawer={openDrawer > 0}
      onViewHistory={() => setView('history')}
    />
  )
}

export default function App() {
  const [section, setSection] = useState<SectionId>('overview')
  return (
    <AppShell current={section} onNavigate={setSection}>
      {section === 'items' ? <ItemsSection /> : <DashboardPage />}
    </AppShell>
  )
}
