import { expect, test } from '@playwright/test'

test('home page renders the dashboard loading state', async ({ page }) => {
  await page.route('**/api/dashboard', () => {})
  await page.goto('/')
  await expect(page.getByRole('status')).toBeVisible()
})
