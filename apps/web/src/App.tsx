import Dashboard from './dashboard/Dashboard'

export default function App() {
  return (
    <main className="app-main">
      {/* The navigation target belongs to the top bar and links story. */}
      <Dashboard onAddFirstItem={() => {}} />
    </main>
  )
}
