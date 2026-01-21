"use client"

import { useState } from "react"
import { useSettings } from "@/hooks/use-settings"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Calendar, AlertTriangle } from "lucide-react"
import { toast } from "sonner"

export function FeaturesTab() {
  const { settings, updateSettings } = useSettings()

  const [reservationsEnabled, setReservationsEnabled] = useState(settings.reservations_enabled)
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const success = await updateSettings({
        reservations_enabled: reservationsEnabled,
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

      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-muted-foreground">Weitere Funktionen</CardTitle>
          <CardDescription>
            Zusätzliche Funktionsschalter werden in zukünftigen Versionen hinzugefügt.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Geplant: E-Mail-Benachrichtigungen, Automatische Erinnerungen, Export-Funktionen...
          </p>
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
