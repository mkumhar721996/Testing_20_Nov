export type Direction = 'in' | 'out'

export type Item = { id: string; name: string; bin: string; on_hand: number }

export type RecentMovement = {
  id: string
  occurred_at: string
  item_name: string
  bin: string
  direction: Direction
  quantity: number
}

export type Dashboard = {
  items_in_stock: number
  movements_today: number
  item_count: number
  recent_movements: RecentMovement[]
}

export type NewMovement = { itemId: string; quantity: number; direction: Direction }

export type NamedRef = { id: string; name: string }

export type Viewer = 'hr' | 'self' | 'manager'

export type Employee = {
  id: string
  name: string
  job: NamedRef | null
  department: NamedRef
  manager: NamedRef
  viewer: Viewer
}

export type HistoryField = 'job' | 'department' | 'manager'

export type HistoryEntry = {
  id: string
  field: HistoryField
  from_name: string | null
  to_name: string
  effective_date: string
}

export type StructureUpdate = {
  job_id: string | null
  department_id: string | null
  manager_id: string | null
  effective_date: string | null
}
