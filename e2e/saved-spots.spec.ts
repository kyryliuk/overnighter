import { test, expect } from '@playwright/test'

test.describe('Saved Spots screen', () => {
  test('shows empty state when no spots are saved', async ({ page }) => {
    await page.goto('/saved')
    await expect(page.getByRole('heading', { name: 'Saved Spots' })).toBeVisible()
    await expect(page.getByText('No saved spots yet')).toBeVisible()
    await expect(page.getByText('Tap the bookmark icon on any pin to save it')).toBeVisible()
  })

  test('back button navigates to map', async ({ page }) => {
    await page.goto('/saved')
    await page.getByRole('button', { name: 'Back to map' }).click()
    await expect(page).toHaveURL('/')
  })
})
