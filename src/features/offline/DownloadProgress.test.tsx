import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DownloadProgress } from './DownloadProgress'

describe('DownloadProgress', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders progress bar with percentage when downloading', () => {
    render(
      <DownloadProgress
        progress={50}
        total={100}
        status="downloading"
        onRetry={vi.fn()}
        onDismiss={vi.fn()}
      />,
    )
    expect(screen.getByTestId('download-progress')).toBeInTheDocument()
    expect(screen.getByText('50%')).toBeInTheDocument()
    expect(screen.getByText(/downloading tiles/i)).toBeInTheDocument()
  })

  it('renders progressbar with correct aria attributes', () => {
    render(
      <DownloadProgress
        progress={75}
        total={100}
        status="downloading"
        onRetry={vi.fn()}
        onDismiss={vi.fn()}
      />,
    )
    const progressbar = screen.getByRole('progressbar')
    expect(progressbar).toHaveAttribute('aria-valuenow', '75')
    expect(progressbar).toHaveAttribute('aria-valuemin', '0')
    expect(progressbar).toHaveAttribute('aria-valuemax', '100')
  })

  it('renders complete state with checkmark', () => {
    render(
      <DownloadProgress
        progress={100}
        total={100}
        status="complete"
        onRetry={vi.fn()}
        onDismiss={vi.fn()}
      />,
    )
    expect(screen.getByText(/offline ready/i)).toBeInTheDocument()
    expect(screen.getByText('✓')).toBeInTheDocument()
  })

  it('auto-dismisses after 3 seconds on complete', () => {
    const onDismiss = vi.fn()
    render(
      <DownloadProgress
        progress={100}
        total={100}
        status="complete"
        onRetry={vi.fn()}
        onDismiss={onDismiss}
      />,
    )
    expect(onDismiss).not.toHaveBeenCalled()
    vi.advanceTimersByTime(3000)
    expect(onDismiss).toHaveBeenCalledOnce()
  })

  it('renders error state with retry button', () => {
    render(
      <DownloadProgress
        progress={30}
        total={100}
        status="error"
        onRetry={vi.fn()}
        onDismiss={vi.fn()}
      />,
    )
    expect(screen.getByText(/download failed/i)).toBeInTheDocument()
    expect(screen.getByText('Retry')).toBeInTheDocument()
  })

  it('calls onRetry when Retry button is clicked', () => {
    const onRetry = vi.fn()
    render(
      <DownloadProgress
        progress={30}
        total={100}
        status="error"
        onRetry={onRetry}
        onDismiss={vi.fn()}
      />,
    )
    screen.getByText('Retry').click()
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it('shows 0% when total is 0', () => {
    render(
      <DownloadProgress
        progress={0}
        total={0}
        status="downloading"
        onRetry={vi.fn()}
        onDismiss={vi.fn()}
      />,
    )
    expect(screen.getByText('0%')).toBeInTheDocument()
  })
})
