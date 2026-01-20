/**
 * Settings/Configuration page with tabbed interface
 */

"use client"

import { Settings, Paintbrush, ToggleLeft, Sparkles } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { BrandingTab } from "@/components/settings/branding-tab"
import { AppearanceTab } from "@/components/settings/appearance-tab"
import { FeaturesTab } from "@/components/settings/features-tab"
import { useSettings } from "@/hooks/use-settings"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export default function SettingsPage() {
  const { isLoading, settings } = useSettings()

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
  )
}
