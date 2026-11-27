import { expect, test } from '@playwright/test'

test('home page renders the Dashboard', async ({ page }) => {
  await page.route('**/api/dashboard', (route) => route.fulfill({ json: { itemCount: 3 } }))
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Warehouse overview' })).toBeVisible()
})
