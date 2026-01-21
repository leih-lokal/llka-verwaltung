"use client"

import { useState } from "react"
import { useSettings } from "@/hooks/use-settings"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ColorPicker } from "@/components/ui/color-picker"
import { FormattedIdStatic } from "@/components/ui/formatted-id"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"

const ID_FORMAT_OPTIONS = [
  { value: "shit", label: "Regal-Notation (SH.IT)", description: "Zweiteilige Box-Darstellung" },
  { value: "#", label: "# (z.B. #42)" },
  { value: "Nr. ", label: "Nr. (z.B. Nr. 42)" },
  { value: "ID-", label: "ID- (z.B. ID-42)" },
  { value: "LL-", label: "LL- (z.B. LL-42)" },
  { value: "none", label: "Ohne Präfix (z.B. 42)" },
]

const PADDING_OPTIONS = [
  { value: "0", label: "Keine Auffüllung (42)" },
  { value: "3", label: "3 Stellen (042)" },
  { value: "4", label: "4 Stellen (0042)" },
  { value: "5", label: "5 Stellen (00042)" },
]

// Convert between internal "none" value and empty string for storage
// "shit" stays as "shit" for SH.IT notation
const toSelectValue = (format: string) => format === "" ? "none" : format
const toStorageValue = (format: string) => format === "none" ? "" : format
const toPreviewFormat = (format: string) => format === "none" ? "" : format

export function AppearanceTab() {
  const { settings, updateSettings } = useSettings()

  const [primaryColor, setPrimaryColor] = useState(settings.primary_color)
  const [idFormat, setIdFormat] = useState(toSelectValue(settings.id_format))
  const [idPadding, setIdPadding] = useState(settings.id_padding)
  const [isSaving, setIsSaving] = useState(false)

  // SH.IT format has fixed padding of 4
  const isShitFormat = idFormat === "shit"
  const effectivePadding = isShitFormat ? 4 : idPadding

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const success = await updateSettings({
        primary_color: primaryColor,
        id_format: toStorageValue(idFormat),
        id_padding: effectivePadding,
      })

      if (success) {
        toast.success("Darstellungs-Einstellungen gespeichert")
      }
    } catch (error) {
      console.error("Failed to save appearance settings:", error)
      toast.error("Fehler beim Speichern der Einstellungen")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Primärfarbe</CardTitle>
          <CardDescription>
            Die Hauptfarbe der Anwendung. Wird für Akzente, Buttons und Hervorhebungen verwendet.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ColorPicker
            value={primaryColor}
            onChange={setPrimaryColor}
          />
          <p className="text-xs text-muted-foreground mt-3">
            Unterstützt oklch (empfohlen), rgb, hsl oder hex Farben.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>ID-Formatierung</CardTitle>
          <CardDescription>
            Wie IDs für Gegenstände angezeigt werden.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="id-format">Format</Label>
              <Select value={idFormat} onValueChange={setIdFormat}>
                <SelectTrigger id="id-format">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ID_FORMAT_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="id-padding">Ziffern-Auffüllung</Label>
              <Select
                value={String(idPadding)}
                onValueChange={(v) => setIdPadding(Number(v))}
                disabled={isShitFormat}
              >
                <SelectTrigger id="id-padding">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PADDING_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {isShitFormat && (
                <p className="text-xs text-muted-foreground">
                  Regal-Notation verwendet immer 4 Stellen.
                </p>
              )}
            </div>
          </div>

          {/* Live Preview */}
          <div className="pt-4 border-t">
            <Label className="text-muted-foreground">Vorschau</Label>
            <div className="mt-2 flex items-center gap-4">
              <div className="px-3 py-2 bg-muted">
                <FormattedIdStatic
                  id={42}
                  format={toStorageValue(idFormat)}
                  padding={effectivePadding}
                  size="lg"
                />
              </div>
              <span className="text-sm text-muted-foreground">
                (Beispiel-ID: 42)
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? "Speichert..." : "Änderungen speichern"}
        </Button>
      </div>
    </div>
  )
}
