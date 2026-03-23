import { test, expect } from '@playwright/test'

test.describe('Onboarding screen', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage so onboarding isn't skipped
    await page.goto('/onboarding')
  })

  test('renders rig class options', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Set up your rig' })).toBeVisible()
    await expect(page.getByRole('radio', { name: 'Class A' })).toBeVisible()
    await expect(page.getByRole('radio', { name: 'Class B' })).toBeVisible()
    await expect(page.getByRole('radio', { name: 'Class C' })).toBeVisible()
    await expect(page.getByRole('radio', { name: 'Travel Trailer' })).toBeVisible()
    await expect(page.getByRole('radio', { name: '5th Wheel' })).toBeVisible()
  })

  test('shows validation error when Save clicked without selecting rig class', async ({ page }) => {
    await page.getByRole('button', { name: 'Save My Rig' }).click()
    await expect(page.getByRole('alert')).toContainText('Please select your rig class')
  })

  test('selecting a rig type fills in default length and height', async ({ page }) => {
    await page.getByRole('radio', { name: 'Class A' }).click()
    await expect(page.getByLabel('Rig length in feet')).toHaveValue('35')
    await expect(page.getByLabel('Height feet')).toHaveValue('12')
  })

  test('selecting a rig type marks it as checked', async ({ page }) => {
    await page.getByRole('radio', { name: 'Travel Trailer' }).click()
    await expect(page.getByRole('radio', { name: 'Travel Trailer' })).toHaveAttribute('aria-checked', 'true')
    await expect(page.getByRole('radio', { name: 'Class A' })).toHaveAttribute('aria-checked', 'false')
  })

  test('length stepper increments and decrements', async ({ page }) => {
    await page.goto('/onboarding')
    const input = page.getByLabel('Rig length in feet')
    const initial = Number(await input.inputValue())

    await page.getByLabel('Increase length').click()
    await expect(input).toHaveValue(String(initial + 1))

    await page.getByLabel('Decrease length').click()
    await expect(input).toHaveValue(String(initial))
  })

  test('Skip for now navigates to map', async ({ page }) => {
    await page.getByRole('button', { name: 'Skip for now' }).click()
    await expect(page).toHaveURL('/')
  })

  test('Save My Rig navigates to map after selecting rig class', async ({ page }) => {
    await page.getByRole('radio', { name: 'Class B' }).click()
    await page.getByRole('button', { name: 'Save My Rig' }).click()
    await expect(page).toHaveURL('/')
  })
})
