import { Route, Routes } from 'react-router-dom'
import CreateEmployeePage from './features/employees/CreateEmployeePage'
import EmployeeProfilePage from './features/employees/EmployeeProfilePage'
import AppShell from './shell/AppShell'

export default function App() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <AppShell section="overview">
            <h1>Web App</h1>
          </AppShell>
        }
      />
      <Route
        path="/employees/new"
        element={
          <AppShell section="items">
            <CreateEmployeePage />
          </AppShell>
        }
      />
      <Route
        path="/employees/me"
        element={
          <AppShell section="items">
            <EmployeeProfilePage />
          </AppShell>
        }
      />
      <Route
        path="/employees/:employeeId"
        element={
          <AppShell section="items">
            <EmployeeProfilePage />
          </AppShell>
        }
      />
    </Routes>
  )
}
