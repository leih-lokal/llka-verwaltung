"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

interface ColorPreset {
  name: string
  value: string
}

const COLOR_PRESETS: ColorPreset[] = [
  { name: "LeihLokal Orange", value: "oklch(0.515 0.283 27.87)" },
  { name: "Blau", value: "oklch(0.55 0.2 250)" },
  { name: "Grün", value: "oklch(0.55 0.2 145)" },
  { name: "Violett", value: "oklch(0.55 0.2 300)" },
  { name: "Rot", value: "oklch(0.55 0.25 25)" },
  { name: "Türkis", value: "oklch(0.6 0.15 195)" },
  { name: "Pink", value: "oklch(0.6 0.2 350)" },
  { name: "Gelb", value: "oklch(0.75 0.15 85)" },
]

interface ColorPickerProps {
  value: string
  onChange: (value: string) => void
  className?: string
}

export function ColorPicker({ value, onChange, className }: ColorPickerProps) {
  const [inputValue, setInputValue] = React.useState(value)

  React.useEffect(() => {
    setInputValue(value)
  }, [value])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value)
  }

  const handleInputBlur = () => {
    if (inputValue !== value) {
      onChange(inputValue)
    }
  }

  const handlePresetClick = (preset: ColorPreset) => {
    setInputValue(preset.value)
    onChange(preset.value)
  }

  return (
    <div className={cn("space-y-3", className)}>
      {/* Color preview and input */}
      <div className="flex items-center gap-3">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="w-12 h-10 p-1 border-2"
              style={{ backgroundColor: value }}
              aria-label="Farbe auswählen"
            >
              <span className="sr-only">Farbe auswählen</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-3" align="start">
            <div className="space-y-3">
              <p className="text-sm font-medium">Voreinstellungen</p>
              <div className="grid grid-cols-4 gap-2">
                {COLOR_PRESETS.map((preset) => (
                  <button
                    key={preset.name}
                    onClick={() => handlePresetClick(preset)}
                    className={cn(
                      "w-full aspect-square border-2 transition-all hover:scale-110",
                      value === preset.value && "ring-2 ring-offset-2 ring-primary"
                    )}
                    style={{ backgroundColor: preset.value }}
                    title={preset.name}
                    aria-label={preset.name}
                  />
                ))}
              </div>
            </div>
          </PopoverContent>
        </Popover>
        <Input
          value={inputValue}
          onChange={handleInputChange}
          onBlur={handleInputBlur}
          placeholder="oklch(0.5 0.2 250) oder #3b82f6"
          className="flex-1 font-mono text-sm"
        />
      </div>

      {/* Quick presets row */}
      <div className="flex flex-wrap gap-1.5">
        {COLOR_PRESETS.slice(0, 6).map((preset) => (
          <button
            key={preset.name}
            onClick={() => handlePresetClick(preset)}
            className={cn(
              "px-2 py-1 text-xs border transition-colors hover:bg-accent",
              value === preset.value && "bg-accent border-primary"
            )}
          >
            {preset.name}
          </button>
        ))}
      </div>
    </div>
  )
}
