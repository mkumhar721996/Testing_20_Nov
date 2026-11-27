import { expect, test } from '@playwright/test'

const LABELS = ['FD', 'PF', 'NPS', 'Transfer money', 'Pay a bill', 'Deposit a cheque']

test('shows the navigation shell and keeps the Dashboard when destinations are activated', async ({
  page,
}) => {
  const writes: string[] = []
  page.on('request', (r) => {
    if (r.method() !== 'GET') writes.push(r.url())
  })
  await page.route('**/api/**', (route) =>
    route.fulfill({
      json: { items_in_stock: 1, movements_today: 1, item_count: 1, recent_movements: [] },
    }),
  )
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Warehouse overview' })).toBeVisible()
  await expect(page.getByText('Banking', { exact: true })).toBeVisible()
  await expect(page.getByRole('img', { name: /signed in as/i })).toBeVisible()

  for (const label of LABELS) {
    const button = page.getByRole('button', { name: new RegExp(`^${label}`) })
    await expect(button).toContainText(/coming soon/i)
    await button.click({ force: true })
  }
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('heading', { name: 'Warehouse overview' })).toBeVisible()
  expect(writes).toEqual([])
})
