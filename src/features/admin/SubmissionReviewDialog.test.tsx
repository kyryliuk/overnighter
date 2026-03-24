import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import SubmissionReviewDialog from './SubmissionReviewDialog'

// Mock HTMLDialogElement.showModal/close since jsdom doesn't support them
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
    this.setAttribute('open', '')
  })
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.removeAttribute('open')
  })
})

const defaultProps = {
  open: true,
  onOpenChange: vi.fn(),
  submissionName: 'Creek Pullout',
  onConfirm: vi.fn(),
  isLoading: false,
}

describe('SubmissionReviewDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('approve action', () => {
    it('renders correct title and body for approve', () => {
      render(<SubmissionReviewDialog {...defaultProps} action="approve" />)
      expect(screen.getByText('Approve Submission?')).toBeInTheDocument()
      expect(
        screen.getByText(/create a new pin from "Creek Pullout" and make it visible/),
      ).toBeInTheDocument()
    })

    it('shows "Confirm Approval" button', () => {
      render(<SubmissionReviewDialog {...defaultProps} action="approve" />)
      expect(screen.getByText('Confirm Approval')).toBeInTheDocument()
    })

    it('does not require notes for approve — confirm is enabled with empty textarea', () => {
      render(<SubmissionReviewDialog {...defaultProps} action="approve" />)
      const confirmBtn = screen.getByText('Confirm Approval')
      expect(confirmBtn).not.toBeDisabled()
    })

    it('calls onConfirm with notes text on approval', () => {
      const onConfirm = vi.fn()
      render(
        <SubmissionReviewDialog {...defaultProps} action="approve" onConfirm={onConfirm} />,
      )
      const textarea = screen.getByLabelText('Admin notes')
      fireEvent.change(textarea, { target: { value: 'Looks good!' } })
      fireEvent.click(screen.getByText('Confirm Approval'))
      expect(onConfirm).toHaveBeenCalledWith('Looks good!')
    })

    it('calls onConfirm with empty string when no notes entered', () => {
      const onConfirm = vi.fn()
      render(
        <SubmissionReviewDialog {...defaultProps} action="approve" onConfirm={onConfirm} />,
      )
      fireEvent.click(screen.getByText('Confirm Approval'))
      expect(onConfirm).toHaveBeenCalledWith('')
    })
  })

  describe('reject action', () => {
    it('renders correct title and body for reject', () => {
      render(<SubmissionReviewDialog {...defaultProps} action="reject" />)
      expect(screen.getByText('Reject Submission?')).toBeInTheDocument()
      expect(
        screen.getByText('Provide a reason — the submitter will be notified.'),
      ).toBeInTheDocument()
    })

    it('requires at least 10 characters — confirm disabled with less', () => {
      render(<SubmissionReviewDialog {...defaultProps} action="reject" />)
      const confirmBtn = screen.getByText('Confirm Rejection')
      expect(confirmBtn).toBeDisabled()

      const textarea = screen.getByLabelText('Admin notes')
      fireEvent.change(textarea, { target: { value: 'Short' } })
      expect(confirmBtn).toBeDisabled()
    })

    it('enables confirm button when 10+ characters entered', () => {
      render(<SubmissionReviewDialog {...defaultProps} action="reject" />)
      const textarea = screen.getByLabelText('Admin notes')
      fireEvent.change(textarea, { target: { value: 'This submission has issues that need addressing' } })
      expect(screen.getByText('Confirm Rejection')).not.toBeDisabled()
    })

    it('shows character count indicator', () => {
      render(<SubmissionReviewDialog {...defaultProps} action="reject" />)
      expect(screen.getByText('0/1000')).toBeInTheDocument()

      const textarea = screen.getByLabelText('Admin notes')
      fireEvent.change(textarea, { target: { value: 'Hello' } })
      expect(screen.getByText('5/1000')).toBeInTheDocument()
    })

    it('shows "X more characters needed" when partially filled', () => {
      render(<SubmissionReviewDialog {...defaultProps} action="reject" />)
      const textarea = screen.getByLabelText('Admin notes')
      fireEvent.change(textarea, { target: { value: 'Hello' } })
      expect(screen.getByText('5 more characters needed')).toBeInTheDocument()
    })

    it('calls onConfirm with trimmed notes', () => {
      const onConfirm = vi.fn()
      render(
        <SubmissionReviewDialog {...defaultProps} action="reject" onConfirm={onConfirm} />,
      )
      const textarea = screen.getByLabelText('Admin notes')
      fireEvent.change(textarea, { target: { value: '  This is a valid rejection reason  ' } })
      fireEvent.click(screen.getByText('Confirm Rejection'))
      expect(onConfirm).toHaveBeenCalledWith('This is a valid rejection reason')
    })
  })

  describe('request_changes action', () => {
    it('renders correct title and body for request_changes', () => {
      render(<SubmissionReviewDialog {...defaultProps} action="request_changes" />)
      expect(screen.getByText('Request Changes')).toBeInTheDocument()
      expect(
        screen.getByText('Describe what needs to change — the submitter will be notified.'),
      ).toBeInTheDocument()
    })

    it('shows "Send Feedback" button', () => {
      render(<SubmissionReviewDialog {...defaultProps} action="request_changes" />)
      expect(screen.getByText('Send Feedback')).toBeInTheDocument()
    })

    it('requires at least 10 characters', () => {
      render(<SubmissionReviewDialog {...defaultProps} action="request_changes" />)
      expect(screen.getByText('Send Feedback')).toBeDisabled()

      const textarea = screen.getByLabelText('Admin notes')
      fireEvent.change(textarea, { target: { value: 'Please add better photos and description' } })
      expect(screen.getByText('Send Feedback')).not.toBeDisabled()
    })
  })

  describe('dialog behavior', () => {
    it('calls onOpenChange(false) when Cancel is clicked', () => {
      const onOpenChange = vi.fn()
      render(
        <SubmissionReviewDialog {...defaultProps} action="approve" onOpenChange={onOpenChange} />,
      )
      fireEvent.click(screen.getByText('Cancel'))
      expect(onOpenChange).toHaveBeenCalledWith(false)
    })

    it('pre-fills notes from initialNotes prop', () => {
      render(
        <SubmissionReviewDialog
          {...defaultProps}
          action="approve"
          initialNotes="Pre-existing note"
        />,
      )
      const textarea = screen.getByLabelText('Admin notes') as HTMLTextAreaElement
      expect(textarea.value).toBe('Pre-existing note')
    })

    it('shows "Processing..." when isLoading is true', () => {
      render(
        <SubmissionReviewDialog {...defaultProps} action="approve" isLoading={true} />,
      )
      expect(screen.getByText('Processing...')).toBeInTheDocument()
    })

    it('disables confirm button when isLoading', () => {
      render(
        <SubmissionReviewDialog {...defaultProps} action="approve" isLoading={true} />,
      )
      expect(screen.getByText('Processing...')).toBeDisabled()
    })

    it('disables cancel button when isLoading', () => {
      render(
        <SubmissionReviewDialog {...defaultProps} action="approve" isLoading={true} />,
      )
      expect(screen.getByText('Cancel')).toBeDisabled()
    })

    it('has proper aria attributes', () => {
      render(<SubmissionReviewDialog {...defaultProps} action="approve" />)
      const dialog = screen.getByRole('dialog')
      expect(dialog).toHaveAttribute('aria-modal', 'true')
      expect(dialog).toHaveAttribute('aria-label', 'Approve Submission?')
    })

    it('sets textarea aria-required correctly based on action', () => {
      const { rerender } = render(
        <SubmissionReviewDialog {...defaultProps} action="approve" />,
      )
      expect(screen.getByLabelText('Admin notes')).toHaveAttribute('aria-required', 'false')

      rerender(<SubmissionReviewDialog {...defaultProps} action="reject" />)
      expect(screen.getByLabelText('Admin notes')).toHaveAttribute('aria-required', 'true')
    })
  })
})
