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
