import { expect, test } from '@playwright/test'

test('clock in, clock out, and see the record', async ({ page }) => {
  let records: unknown[] = []
  const stamp = (d: Date) => d.toISOString()
  await page.route('**/attendance/records', (route) => route.fulfill({ json: records }))
  await page.route('**/attendance/clock-in', (route) => {
    const now = new Date()
    records = [{ id: '1', date: stamp(now).slice(0, 10), clock_in_at: stamp(now), clock_out_at: null }]
    return route.fulfill({ status: 201, json: records[0] })
  })
  await page.route('**/attendance/clock-out', (route) => {
    records = [{ ...(records[0] as object), clock_out_at: stamp(new Date()) }]
    return route.fulfill({ json: records[0] })
  })

  await page.goto('/')
  await page.getByRole('button', { name: 'Clock in' }).click()
  await expect(page.getByText('Clocked in', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Clock out' }).click()
  await expect(page.getByText('Clocked out', { exact: true })).toBeVisible()
  await expect(page.getByRole('row')).toHaveCount(2)
})
