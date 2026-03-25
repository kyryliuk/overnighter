import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { OfflineDownloadGate } from './OfflineDownloadGate'

describe('OfflineDownloadGate', () => {
  it('renders download button for all users', () => {
    render(<OfflineDownloadGate />)

    expect(screen.getByTestId('offline-download-button')).toBeInTheDocument()
    expect(screen.getByText('Download area')).toBeInTheDocument()
  })

  it('does not render a premium upsell', () => {
    render(<OfflineDownloadGate />)

    expect(screen.queryByTestId('premium-gate-upsell')).not.toBeInTheDocument()
    expect(screen.queryByText('Unlock with Premium')).not.toBeInTheDocument()
  })

  it('renders custom children when provided', () => {
    render(
      <OfflineDownloadGate>
        <div data-testid="custom-content">Custom Download UI</div>
      </OfflineDownloadGate>,
    )

    expect(screen.getByTestId('custom-content')).toBeInTheDocument()
    expect(screen.queryByTestId('offline-download-button')).not.toBeInTheDocument()
  })

  it('calls onStartPreview when download button is clicked', () => {
    const onStartPreview = vi.fn()
    render(<OfflineDownloadGate onStartPreview={onStartPreview} />)

    screen.getByTestId('offline-download-button').click()
    expect(onStartPreview).toHaveBeenCalledOnce()
  })
})
