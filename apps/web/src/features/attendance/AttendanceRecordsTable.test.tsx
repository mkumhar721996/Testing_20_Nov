import { render, screen, within } from '@testing-library/react'
import { expect, it } from 'vitest'
import type { AttendanceRecord } from './api'
import AttendanceRecordsTable from './AttendanceRecordsTable'

const records: AttendanceRecord[] = [
  {
    id: '2',
    date: '2026-11-24',
    clockInAt: new Date(2026, 10, 24, 9, 2).toISOString(),
    clockOutAt: null,
  },
  {
    id: '1',
    date: '2026-11-23',
    clockInAt: new Date(2026, 10, 23, 8, 58).toISOString(),
    clockOutAt: new Date(2026, 10, 23, 17, 12).toISOString(),
  },
]

it('shows date, clock in and clock out per row, in the given order', () => {
  render(<AttendanceRecordsTable records={records} />)
  const rows = screen.getAllByRole('row')
  expect(rows[1]).toHaveTextContent('Tue 24 Nov 2026')
  expect(within(rows[1]).getByText('In progress')).toBeInTheDocument()
  expect(within(rows[2]).getByText('Mon 23 Nov 2026')).toBeInTheDocument()
  expect(within(rows[2]).getByText('08:58')).toBeInTheDocument()
  expect(within(rows[2]).getByText('17:12')).toBeInTheDocument()
  expect(within(rows[2]).getByText('8 h 14 m')).toBeInTheDocument()
})
