import { useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useFaucetClassifier } from './useFaucetClassifier'
import FaucetResultBadge from './FaucetResultBadge'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

function validateFile(file: File): string | null {
  if (!file.type.startsWith('image/')) return 'Only image files are supported.'
  if (file.size > MAX_FILE_SIZE) return 'File is too large. Maximum size is 10 MB.'
  return null
}

export default function FaucetCheckerPage() {
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)

  const mutation = useFaucetClassifier()

  const handleFileSelect = useCallback((file: File) => {
    const error = validateFile(file)
    if (error) {
      setValidationError(error)
      return
    }
    setValidationError(null)
    mutation.reset()
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setSelectedFile(file)
    setPreviewUrl(URL.createObjectURL(file))
  }, [previewUrl, mutation])

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFileSelect(file)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }

  function handleDragEnter(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }

  function handleDragLeave(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFileSelect(file)
  }

  function handleAnalyze() {
    if (!selectedFile) return
    mutation.mutate(selectedFile)
  }

  function handleClear() {
    setSelectedFile(null)
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    setValidationError(null)
    mutation.reset()
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border flex-shrink-0">
        <button
          onClick={() => navigate('/')}
          aria-label="Back to map"
          className="text-sky-500 min-h-[44px] min-w-[44px] flex items-center justify-center"
        >
          ←
        </button>
        <div>
          <h1 className="text-lg font-bold leading-tight">Faucet Status Checker</h1>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-6 flex flex-col gap-5 max-w-lg mx-auto w-full">
        <p className="text-sm text-muted-foreground">
          Upload a photo of a water faucet to check its status using AI.
        </p>

        {/* Drop zone */}
        <div
          role="button"
          tabIndex={0}
          aria-label="Upload image — drag and drop or click to browse"
          onDragOver={handleDragOver}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !selectedFile && fileInputRef.current?.click()}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click() }}
          className={[
            'relative rounded-2xl border-2 border-dashed transition-colors cursor-pointer overflow-hidden',
            'flex flex-col items-center justify-center min-h-[220px]',
            isDragOver
              ? 'border-sky-500 bg-sky-500/10'
              : 'border-border bg-muted/20 hover:bg-muted/40',
          ].join(' ')}
        >
          {previewUrl ? (
            <>
              <img
                src={previewUrl}
                alt="Selected faucet"
                className="w-full h-full object-cover max-h-72"
              />
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handleClear() }}
                aria-label="Remove selected image"
                className="absolute top-2 right-2 w-8 h-8 flex items-center justify-center rounded-full bg-black/60 text-white text-sm hover:bg-black/80"
              >
                ✕
              </button>
            </>
          ) : (
            <div className="flex flex-col items-center gap-3 p-6 text-center pointer-events-none">
              <span className="text-4xl" aria-hidden="true">🖼️</span>
              <p className="text-sm font-medium text-foreground">Drag & drop an image here</p>
              <p className="text-xs text-muted-foreground">or click to browse — JPG, PNG, WEBP up to 10 MB</p>
            </div>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleInputChange}
          className="sr-only"
          aria-label="Browse files"
          data-testid="faucet-file-input"
        />

        {/* Browse button (always visible) */}
        {!previewUrl && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full min-h-[44px] rounded-xl border border-border text-sm font-medium text-foreground hover:bg-muted/40 transition-colors"
          >
            Browse files
          </button>
        )}

        {/* Validation error */}
        {validationError && (
          <p role="alert" className="text-sm text-red-500">
            {validationError}
          </p>
        )}

        {/* Analyze button */}
        {selectedFile && (
          <button
            type="button"
            onClick={handleAnalyze}
            disabled={mutation.isPending}
            className="w-full min-h-[44px] rounded-xl text-white text-sm font-medium transition-opacity disabled:opacity-50"
            style={{ backgroundColor: '#0ea5e9' }}
          >
            {mutation.isPending ? 'Analyzing…' : 'Analyze Photo'}
          </button>
        )}

        {/* Result badge */}
        <FaucetResultBadge
          label={mutation.data?.label ?? null}
          confidence={mutation.data?.confidence ?? null}
          isLoading={mutation.isPending}
        />

        {/* API error */}
        {mutation.isError && (
          <p role="alert" className="text-sm text-red-500 text-center">
            {mutation.error.message}
          </p>
        )}

        {/* Footer note */}
        <p className="text-xs text-muted-foreground text-center mt-auto pt-4">
          Powered by AWS SageMaker · ResNet-18 model
        </p>
      </div>
    </div>
  )
}
