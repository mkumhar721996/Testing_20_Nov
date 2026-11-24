import { Navigate, Route, Routes } from 'react-router-dom'
import CreateEmployeePage from './features/employees/CreateEmployeePage'
import EmployeeProfilePage from './features/employees/EmployeeProfilePage'
import AppShell from './shell/AppShell'

export default function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Navigate to="/employees/me" replace />} />
        <Route path="/employees/new" element={<CreateEmployeePage />} />
        <Route path="/employees/me" element={<EmployeeProfilePage />} />
        <Route path="/employees/:employeeId" element={<EmployeeProfilePage />} />
      </Routes>
    </AppShell>
  )
}
