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
              <Input
                id="ic-max-dim"
                type="number"
                min={64}
                max={8192}
                value={ic.max_dimension_px}
                onChange={(e) => updateIc("max_dimension_px", Math.max(64, Math.min(8192, Number(e.target.value) || 0)))}
                disabled={compressionDisabled}
              />
              <p className="text-xs text-muted-foreground">Längste Kante. Kleinere Bilder werden nicht vergrößert.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ic-skip-kb">Mindestgröße zum Komprimieren (KB)</Label>
              <Input
                id="ic-skip-kb"
                type="number"
                min={0}
                value={ic.skip_if_smaller_than_kb}
                onChange={(e) => updateIc("skip_if_smaller_than_kb", Math.max(0, Number(e.target.value) || 0))}
                disabled={compressionDisabled}
              />
              <p className="text-xs text-muted-foreground">Kleinere Dateien werden unverändert hochgeladen.</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ic-quality">Qualität (1–100)</Label>
            <Input
              id="ic-quality"
              type="number"
              min={1}
              max={100}
              value={ic.quality}
              onChange={(e) => updateIc("quality", Math.max(1, Math.min(100, Number(e.target.value) || 1)))}
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
