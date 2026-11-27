import { expect, test } from '@playwright/test'

test('empty Dashboard offers Add first item', async ({ page }) => {
  await page.route('**/api/dashboard', (route) => route.fulfill({ json: { itemCount: 0 } }))
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Add first item' })).toBeVisible()
})

test('Try again shows the normal view when the next load succeeds', async ({ page }) => {
  let calls = 0
  await page.route('**/api/dashboard', (route) =>
    ++calls === 1 ? route.fulfill({ status: 500 }) : route.fulfill({ json: { itemCount: 3 } }),
  )
  await page.goto('/')
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(page.getByRole('heading', { name: 'Warehouse overview' })).toBeVisible()
})

test('Try again shows the error again when the next load fails', async ({ page }) => {
  await page.route('**/api/dashboard', (route) => route.fulfill({ status: 500 }))
  await page.goto('/')
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible()
})
