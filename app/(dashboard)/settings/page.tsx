/**
 * Settings/Configuration page with tabbed interface
 */

"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Settings, Paintbrush, ToggleLeft, Sparkles, AlertTriangle, Loader2 } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { BrandingTab } from "@/components/settings/branding-tab"
import { AppearanceTab } from "@/components/settings/appearance-tab"
import { FeaturesTab } from "@/components/settings/features-tab"
import { useSettings } from "@/hooks/use-settings"
import { Button } from "@/components/ui/button"
import { pb } from "@/lib/pocketbase/client"
import { toast } from "sonner"
import Link from "next/link"
import { createSettingsCollection } from "./actions"

const CONFIRMATION_TEXT = "ERSTELLEN"

export default function SettingsPage() {
  const router = useRouter()
  const { isLoading, settings, collectionExists, refreshSettings } = useSettings()
  const [showMissingCollectionDialog, setShowMissingCollectionDialog] = useState(false)
  const [confirmationInput, setConfirmationInput] = useState("")
  const [isCreatingCollection, setIsCreatingCollection] = useState(false)

  // Show dialog when collection doesn't exist
  useEffect(() => {
    if (!isLoading && !collectionExists) {
      setShowMissingCollectionDialog(true)
    }
  }, [isLoading, collectionExists])

  const handleReturn = () => {
    router.back()
  }

  const handleCreateCollection = async () => {
    setIsCreatingCollection(true)
    try {
      // Create the collection via server action (protects auth token)
      const result = await createSettingsCollection(pb.baseUrl, pb.authStore.token)

      if (!result.success) {
        throw new Error(result.error || "Unbekannter Fehler")
      }

      toast.success("Settings-Collection wurde erfolgreich erstellt")
      setShowMissingCollectionDialog(false)
      setConfirmationInput("")

      // Refresh settings to pick up the new collection
      await refreshSettings()
    } catch (error) {
      console.error("Failed to create settings collection:", error)
      const message = error instanceof Error ? error.message : "Unbekannter Fehler"
      toast.error(`Collection konnte nicht erstellt werden: ${message}`)
    } finally {
      setIsCreatingCollection(false)
    }
  }

  const isConfirmationValid = confirmationInput === CONFIRMATION_TEXT

  if (isLoading) {
    return (
      <div className="container max-w-4xl py-8">
        <div className="space-y-6">
          <div className="h-8 w-48 bg-muted animate-pulse" />
          <div className="h-96 bg-muted animate-pulse" />
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Missing Collection Warning Dialog - cannot be dismissed, must use buttons */}
      <Dialog open={showMissingCollectionDialog} onOpenChange={() => {}}>
        <DialogContent showCloseButton={false} className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="h-5 w-5" />
              Settings-Collection nicht gefunden
            </DialogTitle>
            <DialogDescription className="text-left space-y-3 pt-2">
              <p>
                Die <code className="bg-muted px-1 py-0.5 rounded text-sm">settings</code>-Collection
                existiert noch nicht in deiner PocketBase-Datenbank.
              </p>
              <p>
                Du kannst die Collection jetzt automatisch erstellen lassen. Dafür benötigst du
                Superuser-Rechte in PocketBase.
              </p>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-4">
            <Label htmlFor="confirmation" className="text-sm text-muted-foreground">
              Tippe <span className="font-mono font-bold text-foreground">{CONFIRMATION_TEXT}</span> ein,
              um die Collection zu erstellen:
            </Label>
            <Input
              id="confirmation"
              value={confirmationInput}
              onChange={(e) => setConfirmationInput(e.target.value.toUpperCase())}
              placeholder={CONFIRMATION_TEXT}
              className="font-mono"
              autoComplete="off"
              disabled={isCreatingCollection}
            />
          </div>

          <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={handleReturn}
              className="w-full sm:w-auto"
              disabled={isCreatingCollection}
            >
              Zurück
            </Button>
            <Button
              onClick={handleCreateCollection}
              disabled={!isConfirmationValid || isCreatingCollection}
              className="w-full sm:w-auto"
            >
              {isCreatingCollection ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Erstelle Collection...
                </>
              ) : (
                "Collection erstellen"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    <div className="container max-w-4xl mx-auto px-4 py-8">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Settings className="h-6 w-6" />
              Konfiguration
            </h1>
            <p className="text-muted-foreground mt-1">
              Passe Branding, Darstellung und Funktionen deiner Installation an.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/setup">
              <Sparkles className="h-4 w-4 mr-2" />
              {settings.setup_complete ? 'Setup-Assistent erneut starten' : 'Setup-Assistent starten'}
            </Link>
          </Button>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="branding" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="branding" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Branding</span>
            </TabsTrigger>
            <TabsTrigger value="appearance" className="flex items-center gap-2">
              <Paintbrush className="h-4 w-4" />
              <span className="hidden sm:inline">Darstellung</span>
            </TabsTrigger>
            <TabsTrigger value="features" className="flex items-center gap-2">
              <ToggleLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Funktionen</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="branding">
            <BrandingTab />
          </TabsContent>

          <TabsContent value="appearance">
            <AppearanceTab />
          </TabsContent>

          <TabsContent value="features">
            <FeaturesTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
    </>
  )
}
