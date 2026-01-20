"use client"

import { useState, useRef } from "react"
import { useSettings } from "@/hooks/use-settings"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Upload, X, Image as ImageIcon } from "lucide-react"
import { toast } from "sonner"
import { pb } from "@/lib/pocketbase/client"

const MAX_IMAGE_SIZE = 500

/**
 * Compress and resize an image file to max dimensions
 * Returns a new File object with the compressed image
 */
async function compressImage(file: File, maxSize: number = MAX_IMAGE_SIZE): Promise<File> {
  // SVGs don't need compression
  if (file.type === "image/svg+xml") {
    return file
  }

  return new Promise((resolve, reject) => {
    const img = new Image()
    const canvas = document.createElement("canvas")
    const ctx = canvas.getContext("2d")

    img.onload = () => {
      let { width, height } = img

      // Calculate new dimensions while maintaining aspect ratio
      if (width > maxSize || height > maxSize) {
        if (width > height) {
          height = Math.round((height * maxSize) / width)
          width = maxSize
        } else {
          width = Math.round((width * maxSize) / height)
          height = maxSize
        }
      }

      canvas.width = width
      canvas.height = height

      if (!ctx) {
        reject(new Error("Could not get canvas context"))
        return
      }

      ctx.drawImage(img, 0, 0, width, height)

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Could not compress image"))
            return
          }

          // Create new file with original name
          const compressedFile = new File([blob], file.name, {
            type: "image/png",
            lastModified: Date.now(),
          })

          resolve(compressedFile)
        },
        "image/png",
        0.9
      )
    }

    img.onerror = () => reject(new Error("Could not load image"))

    // Load image from file
    const reader = new FileReader()
    reader.onload = (e) => {
      img.src = e.target?.result as string
    }
    reader.onerror = () => reject(new Error("Could not read file"))
    reader.readAsDataURL(file)
  })
}

export function BrandingTab() {
  const { settings, rawSettings, updateSettings, getFileUrl, refreshSettings } = useSettings()

  const [appName, setAppName] = useState(settings.app_name)
  const [tagline, setTagline] = useState(settings.tagline)
  const [copyrightHolder, setCopyrightHolder] = useState(settings.copyright_holder)
  const [showPoweredBy, setShowPoweredBy] = useState(settings.show_powered_by)
  const [isSaving, setIsSaving] = useState(false)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)

  const logoInputRef = useRef<HTMLInputElement>(null)

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setLogoFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setLogoPreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const clearLogo = () => {
    setLogoFile(null)
    setLogoPreview(null)
    if (logoInputRef.current) {
      logoInputRef.current.value = ""
    }
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      // Prepare form data for file upload
      const formData = new FormData()
      formData.append("app_name", appName)
      formData.append("tagline", tagline)
      formData.append("copyright_holder", copyrightHolder)
      formData.append("show_powered_by", String(showPoweredBy))

      if (logoFile) {
        // Compress image before upload
        const compressedLogo = await compressImage(logoFile)
        formData.append("logo", compressedLogo)
      }

      // Use PocketBase directly for file upload
      if (rawSettings) {
        await pb.collection("settings").update(rawSettings.id, formData)
      } else {
        // Include other default values when creating
        formData.append("primary_color", settings.primary_color)
        formData.append("id_format", settings.id_format)
        formData.append("id_padding", String(settings.id_padding))
        formData.append("reservations_enabled", String(settings.reservations_enabled))
        formData.append("setup_complete", String(settings.setup_complete))
        await pb.collection("settings").create(formData)
      }

      await refreshSettings()
      clearLogo()
      toast.success("Branding-Einstellungen gespeichert")
    } catch (error) {
      console.error("Failed to save branding settings:", error)
      toast.error("Fehler beim Speichern der Einstellungen")
    } finally {
      setIsSaving(false)
    }
  }

  const currentLogoUrl = getFileUrl(settings.logo)

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Anwendungsname</CardTitle>
          <CardDescription>
            Der Name, der in der Navigation und im Browser-Tab angezeigt wird.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="app-name">Name</Label>
            <Input
              id="app-name"
              value={appName}
              onChange={(e) => setAppName(e.target.value)}
              placeholder="z.B. BiblioBorrow"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tagline">Untertitel</Label>
            <Input
              id="tagline"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              placeholder="z.B. Verwaltungssoftware"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Logo</CardTitle>
          <CardDescription>
            Ein quadratisches Logo (PNG oder SVG empfohlen, min. 40x40px).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-4">
            {/* Current/Preview logo */}
            <div className="flex-shrink-0 w-20 h-20 border-2 border-dashed flex items-center justify-center bg-muted">
              {logoPreview ? (
                <img src={logoPreview} alt="Neues Logo" className="w-full h-full object-contain" />
              ) : currentLogoUrl ? (
                <img src={currentLogoUrl} alt="Aktuelles Logo" className="w-full h-full object-contain" />
              ) : (
                <ImageIcon className="w-8 h-8 text-muted-foreground" />
              )}
            </div>

            <div className="flex-1 space-y-2">
              <input
                ref={logoInputRef}
                type="file"
                accept="image/png,image/svg+xml,image/jpeg"
                onChange={handleLogoChange}
                className="hidden"
                id="logo-upload"
              />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => logoInputRef.current?.click()}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Logo hochladen
                </Button>
                {(logoPreview || currentLogoUrl) && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={clearLogo}
                    title="Logo entfernen"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
              {logoFile && (
                <p className="text-sm text-muted-foreground">
                  Ausgewählt: {logoFile.name}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Footer & Attribution</CardTitle>
          <CardDescription>
            Copyright-Informationen und Powered-by-Hinweis.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="copyright">Copyright-Inhaber</Label>
            <Input
              id="copyright"
              value={copyrightHolder}
              onChange={(e) => setCopyrightHolder(e.target.value)}
              placeholder="z.B. Bürgerstiftung Karlsruhe"
            />
            <p className="text-xs text-muted-foreground">
              Wird als &quot;© {new Date().getFullYear()} {copyrightHolder || "[Name]"}&quot; angezeigt.
            </p>
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="space-y-0.5">
              <Label htmlFor="powered-by">&quot;Powered by LLKA-V&quot; anzeigen</Label>
              <p className="text-xs text-muted-foreground">
                Zeigt einen dezenten Hinweis auf die zugrundeliegende Software.
              </p>
            </div>
            <Switch
              id="powered-by"
              checked={showPoweredBy}
              onCheckedChange={setShowPoweredBy}
            />
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
