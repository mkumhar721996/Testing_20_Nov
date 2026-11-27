import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

const ITEM_A = { id: 'item-a-id', name: 'Item A', bin: 'A-01', on_hand: 3 }

// The preview server has no API, so serve /api from an in-test state object.
async function mockApi(page: Page, failSave = false) {
  const state = { stock: 1284, moves: 42 }
  await page.route('**/api/**', async (route) => {
    const { pathname } = new URL(route.request().url())
    if (pathname.endsWith('/items')) return route.fulfill({ json: [ITEM_A] })
    if (pathname.endsWith('/dashboard')) {
      return route.fulfill({
        json: {
          items_in_stock: state.stock,
          movements_today: state.moves,
          item_count: 1,
          recent_movements: [],
        },
      })
    }
    if (failSave) return route.fulfill({ status: 500, json: {} })
    state.stock += 5
    state.moves += 1
    return route.fulfill({ status: 201, json: {} })
  })
}

test('records a movement from the Dashboard', async ({ page }) => {
  await mockApi(page)
  await page.goto('/')
  await expect(page.getByText('1,284')).toBeVisible()

  await page.getByRole('button', { name: 'Record movement' }).click()
  await page.getByRole('button', { name: 'Save movement' }).click()
  await expect(page.getByText('Choose the item that moved.')).toBeVisible()

  await page.getByLabel('Item').selectOption('item-a-id')
  await page.getByLabel('Quantity').fill('5')
  await page.getByRole('radio', { name: 'Goods in' }).check()
  await page.getByRole('button', { name: 'Save movement' }).click()

  await expect(page.getByRole('dialog')).toBeHidden()
  await expect(page.getByText('1,289')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Warehouse overview' })).toBeVisible()
})

test('keeps the drawer and values when the save fails', async ({ page }) => {
  await mockApi(page, true)
  await page.goto('/')
  await page.getByRole('button', { name: 'Record movement' }).click()
  await page.getByLabel('Item').selectOption('item-a-id')
  await page.getByLabel('Quantity').fill('5')
  await page.getByRole('button', { name: 'Save movement' }).click()

  await expect(page.getByRole('dialog').getByRole('alert')).toContainText(
    'The movement could not be saved.',
  )
  await expect(page.getByLabel('Quantity')).toHaveValue('5')
})

const EMP_ID = 'emp-1'

async function mockEmployeeApi(page: Page) {
  const state = { department: { id: 'd1', name: 'Finance' } }
  const departments = [state.department, { id: 'd2', name: 'Engineering' }]
  await page.route('**/api/**', async (route) => {
    const { pathname } = new URL(route.request().url())
    if (pathname.endsWith('/structure')) {
      state.department = departments[1]
      return route.fulfill({ json: {} })
    }
    if (pathname.endsWith('/departments')) return route.fulfill({ json: departments })
    if (pathname.endsWith('/jobs')) return route.fulfill({ json: [{ id: 'j1', name: 'Accountant' }] })
    if (pathname.endsWith('/managers')) return route.fulfill({ json: [{ id: 'm1', name: 'Hannah Brooks' }] })
    if (pathname.endsWith(`/employees/${EMP_ID}`)) {
      return route.fulfill({
        json: {
          id: EMP_ID,
          name: 'Priya Nair',
          job: { id: 'j1', name: 'Accountant' },
          department: state.department,
          manager: { id: 'm1', name: 'Hannah Brooks' },
          viewer: 'hr',
        },
      })
    }
    return route.fulfill({ json: {} })
  })
}

test('HR changes an employee department', async ({ page }) => {
  await mockEmployeeApi(page)
  await page.goto(`/?employee=${EMP_ID}`)
  await page.getByRole('link', { name: 'Items', includeHidden: true }).click()
  await page.getByRole('button', { name: 'Change job, department or manager' }).click()

  await page.getByLabel('Department').selectOption('')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByText("Choose a department. The record can't be saved without one.")).toBeVisible()

  await page.getByLabel('Department').selectOption('d2')
  await page.getByLabel('Effective date').fill('2024-03-01')
  await page.getByRole('button', { name: 'Save changes' }).click()

  await expect(page.getByRole('dialog')).toBeHidden()
  await expect(page.getByRole('term').filter({ hasText: 'Department' })).toBeVisible()
  await expect(page.getByText('Engineering', { exact: true })).toBeVisible()
  await expect(page.getByRole('status')).toContainText('saved')
})
