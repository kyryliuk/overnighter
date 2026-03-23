import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRigStore } from '@/store/rigStore'
import { type RigType } from '@/types/rigProfile'
import { cn } from '@/lib/utils'

// Class defaults (SCREAMING_SNAKE_CASE per architecture)
const RIG_DEFAULTS: Record<RigType, { lengthFt: number; heightFt: number }> = {
  'Class A': { lengthFt: 35, heightFt: 12.5 },
  'Class B': { lengthFt: 20, heightFt: 7.0 },
  'Class C': { lengthFt: 28, heightFt: 11.0 },
  'Travel Trailer': { lengthFt: 25, heightFt: 10.0 },
  '5th Wheel': { lengthFt: 30, heightFt: 12.0 },
}

const RIG_TYPES: RigType[] = ['Class A', 'Class B', 'Class C', 'Travel Trailer', '5th Wheel']

const LENGTH_MIN = 10
const LENGTH_MAX = 65
const HEIGHT_FT_MIN = 6
const HEIGHT_FT_MAX = 16

function toDecimalFeet(ft: number, inches: number): number {
  return ft + inches / 12
}

function fromDecimalFeet(decimal: number): { ft: number; inches: number } {
  const ft = Math.floor(decimal)
  const inches = Math.round((decimal - ft) * 12)
  return { ft, inches }
}

export default function RigEditScreen() {
  const navigate = useNavigate()
  const rigProfile = useRigStore((state) => state.rigProfile)
  const setRigProfile = useRigStore((state) => state.setRigProfile)

  // Pre-populate from saved profile (Zustand persist rehydrates before render)
  const initialHeightParts = fromDecimalFeet(rigProfile.heightFt ?? 10)

  const [selectedRigType, setSelectedRigType] = useState<RigType | null>(rigProfile.rigType)
  const [lengthFt, setLengthFt] = useState<number>(rigProfile.lengthFt ?? 25)
  const [lengthInput, setLengthInput] = useState<string>(String(rigProfile.lengthFt ?? 25))
  const [heightFtPart, setHeightFtPart] = useState<number>(initialHeightParts.ft)
  const [heightInPart, setHeightInPart] = useState<number>(initialHeightParts.inches)
  const [heightFtInput, setHeightFtInput] = useState<string>(String(initialHeightParts.ft))
  const [heightInInput, setHeightInInput] = useState<string>(String(initialHeightParts.inches))
  const [validationError, setValidationError] = useState<string | null>(null)

  function handleSelectRigType(rigType: RigType) {
    setSelectedRigType(rigType)
    setValidationError(null) // M1: clear validation error when a class is chosen
    const defaults = RIG_DEFAULTS[rigType]
    setLengthFt(defaults.lengthFt)
    setLengthInput(String(defaults.lengthFt))
    const { ft, inches } = fromDecimalFeet(defaults.heightFt)
    setHeightFtPart(ft)
    setHeightInPart(inches)
    setHeightFtInput(String(ft))
    setHeightInInput(String(inches))
  }

  function handleLengthChange(value: number) {
    const clamped = Math.max(LENGTH_MIN, Math.min(LENGTH_MAX, value))
    setLengthFt(clamped)
    setLengthInput(String(clamped))
  }

  function handleHeightFtChange(value: number) {
    const clamped = Math.max(HEIGHT_FT_MIN, Math.min(HEIGHT_FT_MAX, value))
    setHeightFtPart(clamped)
    setHeightFtInput(String(clamped))
    if (clamped === HEIGHT_FT_MAX) {
      // M2: at 16ft the inches must be 0 to not exceed the 16ft maximum
      setHeightInPart(0)
      setHeightInInput('0')
    }
  }

  function handleHeightInChange(value: number) {
    // M2: when feet is at max, inches must be 0 to keep total ≤ 16ft
    const maxIn = heightFtPart === HEIGHT_FT_MAX ? 0 : 11
    const clamped = Math.max(0, Math.min(maxIn, value))
    setHeightInPart(clamped)
    setHeightInInput(String(clamped))
  }

  // M3: Commit number input strings to clamped numeric state on blur
  function commitLengthInput() {
    const num = parseFloat(lengthInput)
    handleLengthChange(isNaN(num) ? lengthFt : num)
  }

  function commitHeightFtInput() {
    const num = parseFloat(heightFtInput)
    handleHeightFtChange(isNaN(num) ? heightFtPart : num)
  }

  function commitHeightInInput() {
    const num = parseFloat(heightInInput)
    handleHeightInChange(isNaN(num) ? heightInPart : num)
  }

  function handleSave() {
    if (!selectedRigType) {
      setValidationError('Please select your rig class')
      return
    }
    setValidationError(null)
    const clampedFtPart = Math.max(HEIGHT_FT_MIN, Math.min(HEIGHT_FT_MAX, heightFtPart))
    // M2: final safety — ensure inches are 0 when feet is at max
    const clampedInPart = clampedFtPart === HEIGHT_FT_MAX ? 0 : Math.max(0, Math.min(11, heightInPart))
    setRigProfile({
      rigType: selectedRigType,
      lengthFt: Math.max(LENGTH_MIN, Math.min(LENGTH_MAX, lengthFt)),
      heightFt: toDecimalFeet(clampedFtPart, clampedInPart),
    })
    navigate('/')
  }

  function handleCancel() {
    navigate('/') // Simply navigate away — state is local, store untouched
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Header */}
      <div className="px-6 pt-10 pb-6">
        <h1 className="text-2xl font-bold">Edit your rig</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Update your rig details at any time.
        </p>
      </div>

      {/* Scrollable content — leaves room for fixed bottom bar */}
      <div className="flex-1 px-6 space-y-8 pb-36 overflow-y-auto">

        {/* Step 1: Rig Class */}
        <section>
          <h2 className="text-lg font-semibold mb-3">Rig class</h2>
          {/* M4: radiogroup semantics — chips are mutually exclusive */}
          <div role="radiogroup" aria-label="Rig class" className="space-y-2">
            {RIG_TYPES.map((rigType) => (
              <button
                key={rigType}
                type="button"
                onClick={() => handleSelectRigType(rigType)}
                role="radio"
                aria-checked={selectedRigType === rigType}
                className={cn(
                  'w-full text-left px-4 py-3 rounded-lg border transition-colors min-h-[44px]',
                  selectedRigType === rigType
                    ? 'border-primary bg-primary/10 text-foreground'
                    : 'border-border bg-secondary text-muted-foreground hover:border-primary/50'
                )}
              >
                {rigType}
              </button>
            ))}
          </div>
          {validationError && (
            <p role="alert" className="mt-2 text-sm text-red-500">
              {validationError}
            </p>
          )}
        </section>

        {/* Step 2: Length */}
        <section>
          <h2 className="text-lg font-semibold mb-3">Length (ft)</h2>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => handleLengthChange(lengthFt - 1)}
              aria-label="Decrease length"
              className="min-w-[44px] min-h-[44px] rounded-lg border border-border bg-secondary text-foreground flex items-center justify-center text-xl select-none"
            >
              –
            </button>
            <input
              type="number"
              value={lengthInput}
              min={LENGTH_MIN}
              max={LENGTH_MAX}
              onChange={(e) => setLengthInput(e.target.value)}
              onBlur={commitLengthInput}
              aria-label="Rig length in feet"
              className="flex-1 text-center text-xl font-semibold bg-secondary border border-border rounded-lg py-2 text-foreground min-h-[44px]"
            />
            <button
              type="button"
              onClick={() => handleLengthChange(lengthFt + 1)}
              aria-label="Increase length"
              className="min-w-[44px] min-h-[44px] rounded-lg border border-border bg-secondary text-foreground flex items-center justify-center text-xl select-none"
            >
              +
            </button>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{LENGTH_MIN}–{LENGTH_MAX} ft</p>
        </section>

        {/* Step 3: Height */}
        <section>
          <h2 className="text-lg font-semibold mb-3">Height</h2>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={heightFtInput}
              min={HEIGHT_FT_MIN}
              max={HEIGHT_FT_MAX}
              onChange={(e) => setHeightFtInput(e.target.value)}
              onBlur={commitHeightFtInput}
              aria-label="Height feet"
              className="w-20 text-center text-xl font-semibold bg-secondary border border-border rounded-lg py-2 text-foreground min-h-[44px]"
            />
            <span className="text-muted-foreground font-medium">ft</span>
            <input
              type="number"
              value={heightInInput}
              min={0}
              max={heightFtPart === HEIGHT_FT_MAX ? 0 : 11}
              onChange={(e) => setHeightInInput(e.target.value)}
              onBlur={commitHeightInInput}
              aria-label="Height inches"
              className="w-20 text-center text-xl font-semibold bg-secondary border border-border rounded-lg py-2 text-foreground min-h-[44px]"
            />
            <span className="text-muted-foreground font-medium">in</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{HEIGHT_FT_MIN}ft–{HEIGHT_FT_MAX}ft</p>
        </section>

      </div>

      {/* Fixed bottom action bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border px-6 py-4 space-y-3">
        <button
          type="button"
          onClick={handleSave}
          className="w-full min-h-[44px] bg-primary text-primary-foreground rounded-lg font-semibold text-base"
        >
          Save Changes
        </button>
        <button
          type="button"
          onClick={handleCancel}
          className="w-full min-h-[44px] text-muted-foreground text-base"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
