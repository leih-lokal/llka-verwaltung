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

const CONFIRMATION_TEXT = "ERSTELLEN"

/**
 * PocketBase collection schema for the settings collection
 * Matches the official migration format
 */
const SETTINGS_COLLECTION_SCHEMA = {
  id: "pbc_settings_001",
  name: "settings",
  type: "base",
  system: false,
  fields: [
    {
      autogeneratePattern: "[a-z0-9]{15}",
      hidden: false,
      id: "text3208210256",
      max: 15,
      min: 15,
      name: "id",
      pattern: "^[a-z0-9]+$",
      presentable: false,
      primaryKey: true,
      required: true,
      system: true,
      type: "text"
    },
    {
      autogeneratePattern: "",
      hidden: false,
      id: "text1847291650",
      max: 0,
      min: 0,
      name: "app_name",
      pattern: "",
      presentable: true,
      primaryKey: false,
      required: false,
      system: false,
      type: "text"
    },
    {
      autogeneratePattern: "",
      hidden: false,
      id: "text2938475610",
      max: 0,
      min: 0,
      name: "tagline",
      pattern: "",
      presentable: false,
      primaryKey: false,
      required: false,
      system: false,
      type: "text"
    },
    {
      hidden: false,
      id: "file4829371056",
      maxSelect: 1,
      maxSize: 2097152,
      mimeTypes: ["image/png", "image/svg+xml", "image/jpeg"],
      name: "logo",
      presentable: false,
      protected: false,
      required: false,
      system: false,
      thumbs: [],
      type: "file"
    },
    {
      hidden: false,
      id: "file5938271640",
      maxSelect: 1,
      maxSize: 2097152,
      mimeTypes: ["image/png", "image/svg+xml", "image/x-icon", "image/vnd.microsoft.icon"],
      name: "favicon",
      presentable: false,
      protected: false,
      required: false,
      system: false,
      thumbs: [],
      type: "file"
    },
    {
      autogeneratePattern: "",
      hidden: false,
      id: "text6019384752",
      max: 0,
      min: 0,
      name: "copyright_holder",
      pattern: "",
      presentable: false,
      primaryKey: false,
      required: false,
      system: false,
      type: "text"
    },
    {
      hidden: false,
      id: "bool7120495863",
      name: "show_powered_by",
      presentable: false,
      required: false,
      system: false,
      type: "bool"
    },
    {
      autogeneratePattern: "",
      hidden: false,
      id: "text8231506974",
      max: 0,
      min: 0,
      name: "primary_color",
      pattern: "",
      presentable: false,
      primaryKey: false,
      required: false,
      system: false,
      type: "text"
    },
    {
      autogeneratePattern: "",
      hidden: false,
      id: "text9342618085",
      max: 0,
      min: 0,
      name: "id_format",
      pattern: "",
      presentable: false,
      primaryKey: false,
      required: false,
      system: false,
      type: "text"
    },
    {
      hidden: false,
      id: "number1053729196",
      max: null,
      min: 0,
      name: "id_padding",
      onlyInt: true,
      presentable: false,
      required: false,
      system: false,
      type: "number"
    },
    {
      hidden: false,
      id: "bool2164830207",
      name: "reservations_enabled",
      presentable: false,
      required: false,
      system: false,
      type: "bool"
    },
    {
      hidden: false,
      id: "bool3275941318",
      name: "setup_complete",
      presentable: false,
      required: false,
      system: false,
      type: "bool"
    },
    {
      hidden: false,
      id: "autodate2990389176",
      name: "created",
      onCreate: true,
      onUpdate: false,
      presentable: false,
      system: false,
      type: "autodate"
    },
    {
      hidden: false,
      id: "autodate3332085495",
      name: "updated",
      onCreate: true,
      onUpdate: true,
      presentable: false,
      system: false,
      type: "autodate"
    }
  ],
  indexes: [],
  listRule: "",
  viewRule: "",
  createRule: null,
  updateRule: null,
  deleteRule: null
}

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
      // Create the collection via PocketBase admin API
      const response = await fetch(`${pb.baseUrl}/api/collections`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": pb.authStore.token,
        },
        body: JSON.stringify(SETTINGS_COLLECTION_SCHEMA),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || `HTTP ${response.status}`)
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
