"use client"

import { useEffect, useState } from "react"
import { useSettings } from "@/hooks/use-settings"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Calendar, AlertTriangle, ImageDown, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { ImageCompressionSettings, ImageOutputFormat } from "@/types"
import { pb } from "@/lib/pocketbase/client"
import {
  addImageCompressionField,
  hasImageCompressionField,
} from "@/lib/pocketbase/settings-schema"
import {
  compressImageWithOutcome,
  readImageDimensions,
  type CompressOutcome,
  type CompressResult,
} from "@/lib/image/compress"
import { clampNumberInput } from "@/lib/utils/number-input"

const OUTPUT_FORMAT_OPTIONS: { value: ImageOutputFormat; label: string; description: string }[] = [
  {
    value: "keep",
    label: "Original beibehalten",
    description: "PNG bleibt PNG, JPEG bleibt JPEG. Empfohlen.",
  },
  {
    value: "webp",
    label: "WebP",
    description: "Kleinste Dateien. Erfordert WebP-Unterstützung im Zielfeld.",
  },
  {
    value: "jpeg",
    label: "JPEG",
    description: "Beste Kompatibilität, keine Transparenz.",
  },
]

export function FeaturesTab() {
  const { settings, updateSettings, refreshSettings } = useSettings()

  const [reservationsEnabled, setReservationsEnabled] = useState(settings.reservations_enabled)
  const [ic, setIc] = useState<ImageCompressionSettings>(settings.image_compression)
  const updateIc = <K extends keyof ImageCompressionSettings>(key: K, value: ImageCompressionSettings[K]) =>
    setIc((prev) => ({ ...prev, [key]: value }))

  const [isSaving, setIsSaving] = useState(false)
  const [fieldStatus, setFieldStatus] = useState<"unknown" | "present" | "missing">("unknown")
  const [isMigrating, setIsMigrating] = useState(false)

  useEffect(() => {
    let cancelled = false
    hasImageCompressionField(pb.baseUrl, pb.authStore.token).then((present) => {
      if (cancelled) return
      setFieldStatus(present ? "present" : "missing")
    })
    return () => {
      cancelled = true
    }
  }, [])

  const handleAddField = async () => {
    setIsMigrating(true)
    try {
      const result = await addImageCompressionField(pb.baseUrl, pb.authStore.token)
      if (!result.success) throw new Error(result.error || "Unbekannter Fehler")
      toast.success("Feld 'image_compression' hinzugefügt")
      setFieldStatus("present")
      await refreshSettings()
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unbekannter Fehler"
      toast.error(`Migration fehlgeschlagen: ${message}`)
    } finally {
      setIsMigrating(false)
    }
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const success = await updateSettings({
        reservations_enabled: reservationsEnabled,
        ...(fieldStatus === "present" ? { image_compression: ic } : {}),
      })

      if (success) {
        toast.success("Funktionseinstellungen gespeichert")
      }
    } catch (error) {
      console.error("Failed to save feature settings:", error)
      toast.error("Fehler beim Speichern der Einstellungen")
    } finally {
      setIsSaving(false)
    }
  }

  const compressionDisabled = fieldStatus !== "present" || !ic.enabled

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Reservierungen
          </CardTitle>
          <CardDescription>
            Das Reservierungssystem ermöglicht es, Gegenstände für einen bestimmten Zeitpunkt vorzumerken.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="reservations-enabled">Reservierungen aktivieren</Label>
              <p className="text-xs text-muted-foreground">
                Wenn deaktiviert, wird der Menüpunkt ausgegraut und die Funktion ist nicht verfügbar.
              </p>
            </div>
            <Switch
              id="reservations-enabled"
              checked={reservationsEnabled}
              onCheckedChange={setReservationsEnabled}
            />
          </div>

          {!reservationsEnabled && (
            <div className="flex items-start gap-2 p-3 bg-muted text-sm">
              <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
              <p>
                Bei Deaktivierung werden bestehende Reservierungen nicht gelöscht,
                aber der Zugriff auf die Reservierungsverwaltung wird eingeschränkt.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageDown className="h-5 w-5" />
            Bildkomprimierung
          </CardTitle>
          <CardDescription>
            Bilder werden vor dem Hochladen automatisch verkleinert und neu komprimiert.
            Spart Speicherplatz und beschleunigt das Laden im Frontend.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {fieldStatus === "missing" && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-sm">
              <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              <div className="space-y-2 flex-1">
                <p>
                  Diese Einstellung erfordert ein neues Feld in der{" "}
                  <code className="bg-muted px-1 rounded text-xs">settings</code>-Collection.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleAddField}
                  disabled={isMigrating}
                >
                  {isMigrating ? (
                    <>
                      <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                      Migriere...
                    </>
                  ) : (
                    "Feld hinzufügen"
                  )}
                </Button>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="ic-enabled">Komprimierung aktivieren</Label>
              <p className="text-xs text-muted-foreground">
                Schaltet die client-seitige Verkleinerung für alle Bild-Uploads ein.
              </p>
            </div>
            <Switch
              id="ic-enabled"
              checked={ic.enabled}
              onCheckedChange={(v) => updateIc("enabled", v)}
              disabled={fieldStatus !== "present"}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ic-max-dim">Maximale Kantenlänge (px)</Label>
              <ClampedNumberInput
                id="ic-max-dim"
                min={64}
                max={8192}
                value={ic.max_dimension_px}
                onCommit={(v) => updateIc("max_dimension_px", v)}
                disabled={compressionDisabled}
              />
              <p className="text-xs text-muted-foreground">Längste Kante. Kleinere Bilder werden nicht vergrößert.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ic-skip-kb">Mindestgröße zum Komprimieren (KB)</Label>
              <ClampedNumberInput
                id="ic-skip-kb"
                min={0}
                value={ic.skip_if_smaller_than_kb}
                onCommit={(v) => updateIc("skip_if_smaller_than_kb", v)}
                disabled={compressionDisabled}
              />
              <p className="text-xs text-muted-foreground">Kleinere Dateien werden unverändert hochgeladen.</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ic-quality">Qualität (1–100)</Label>
            <ClampedNumberInput
              id="ic-quality"
              min={1}
              max={100}
              value={ic.quality}
              onCommit={(v) => updateIc("quality", v)}
              disabled={compressionDisabled}
            />
            <p className="text-xs text-muted-foreground">
              Nur für JPEG/WebP relevant. Empfohlen: 75–85.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ic-format">Ausgabeformat</Label>
            <Select
              value={ic.output_format}
              onValueChange={(v) => updateIc("output_format", v as ImageOutputFormat)}
              disabled={compressionDisabled}
            >
              <SelectTrigger id="ic-format">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OUTPUT_FORMAT_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    <div className="flex flex-col">
                      <span>{opt.label}</span>
                      <span className="text-xs text-muted-foreground">{opt.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <CompressionPreview settings={ic} />
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

type ClampedNumberInputProps = Omit<
  React.ComponentProps<typeof Input>,
  "type" | "value" | "onChange" | "min" | "max"
> & {
  value: number
  min: number
  max?: number
  /** Called with the clamped value on blur or Enter */
  onCommit: (value: number) => void
}

/**
 * Number input that lets the user type freely and clamps only when the value
 * is committed (blur or Enter). Clamping on every keystroke turned "1200"
 * into 64 after the first digit.
 */
function ClampedNumberInput({
  value,
  min,
  max = Infinity,
  onCommit,
  onBlur,
  onKeyDown,
  ...props
}: ClampedNumberInputProps) {
  const [draft, setDraft] = useState(String(value))

  // Follow external changes to the value (e.g. settings reloaded)
  const [shownValue, setShownValue] = useState(value)
  if (value !== shownValue) {
    setShownValue(value)
    setDraft(String(value))
  }

  const commit = () => {
    const next = clampNumberInput(draft, min, max, value)
    setDraft(String(next))
    if (next !== value) onCommit(next)
  }

  return (
    <Input
      {...props}
      type="number"
      min={min}
      max={Number.isFinite(max) ? max : undefined}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={(e) => {
        commit()
        onBlur?.(e)
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit()
        onKeyDown?.(e)
      }}
    />
  )
}

type Dimensions = { width: number; height: number } | null

const KEPT_ORIGINAL_NOTE: Record<Exclude<CompressOutcome, "compressed">, string> = {
  disabled: "Komprimierung ist deaktiviert – das Original würde unverändert hochgeladen.",
  unsupported: "Dieses Format (z. B. SVG, GIF) wird nicht komprimiert – das Original würde hochgeladen.",
  below_threshold: "Die Datei liegt unter der Mindestgröße – das Original würde hochgeladen.",
  larger: "Die komprimierte Datei wäre nicht kleiner – das Original würde hochgeladen.",
  failed: "Komprimierung fehlgeschlagen (z. B. Bild zu groß für diesen Browser) – das Original würde hochgeladen.",
}

const formatKb = (bytes: number) =>
  `${(bytes / 1024).toLocaleString("de-DE", { maximumFractionDigits: 1 })} KB`
const formatDimensions = (d: Dimensions) => (d ? `${d.width} × ${d.height} px` : "–")

/**
 * Runs the compression helper on a local test image with the current
 * (possibly unsaved) settings. Nothing is uploaded.
 */
function CompressionPreview({ settings }: { settings: ImageCompressionSettings }) {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<{
    original: File
    originalDims: Dimensions
    result: CompressResult
    resultDims: Dimensions
  } | null>(null)

  // Re-run (debounced) whenever the test file or the settings change
  useEffect(() => {
    if (!file) return
    let cancelled = false
    const timer = setTimeout(async () => {
      // Sequential, not parallel: two concurrent decodes of a large photo can
      // exhaust memory on mobile Safari.
      const originalDims = await readImageDimensions(file)
      const result = await compressImageWithOutcome(file, settings)
      const resultDims =
        result.file === file ? originalDims : await readImageDimensions(result.file)
      if (!cancelled) setPreview({ original: file, originalDims, result, resultDims })
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [file, settings])

  const saved =
    preview && preview.result.outcome === "compressed"
      ? Math.round((1 - preview.result.file.size / preview.original.size) * 100)
      : null

  return (
    <div className="space-y-2 border-t pt-4">
      <Label htmlFor="ic-preview">Vorschau mit Testbild</Label>
      <Input
        id="ic-preview"
        type="file"
        accept="image/*"
        onChange={(e) => {
          const next = e.target.files?.[0] ?? null
          setFile(next)
          if (!next) setPreview(null)
        }}
      />
      <p className="text-xs text-muted-foreground">
        Wendet die aktuellen, auch ungespeicherten Einstellungen an. Es wird nichts hochgeladen.
      </p>

      {preview && (
        <div className="space-y-1 text-sm">
          <p>
            <span className="text-muted-foreground">Original:</span>{" "}
            {formatKb(preview.original.size)} · {formatDimensions(preview.originalDims)}
          </p>
          <p>
            <span className="text-muted-foreground">Nach Komprimierung:</span>{" "}
            {formatKb(preview.result.file.size)} · {formatDimensions(preview.resultDims)}
            {saved !== null && ` (−${saved} %)`}
          </p>
          {preview.result.outcome !== "compressed" && (
            <p className="text-xs text-muted-foreground">
              {KEPT_ORIGINAL_NOTE[preview.result.outcome]}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
