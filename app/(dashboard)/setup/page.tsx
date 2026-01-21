/**
 * Setup Wizard Page
 * First-time configuration flow for white-label setup
 */
'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useSettings } from '@/hooks/use-settings';
import { ColorPicker } from '@/components/ui/color-picker';
import { Upload, X, Check, ArrowRight, ArrowLeft, Sparkles, Palette, Building2, PartyPopper } from 'lucide-react';
import { toast } from 'sonner';
import { pb } from '@/lib/pocketbase/client';
import { cn } from '@/lib/utils';

const MAX_IMAGE_SIZE = 500;

async function compressImage(file: File, maxSize: number = MAX_IMAGE_SIZE): Promise<File> {
  if (file.type === 'image/svg+xml') {
    return file;
  }

  return new Promise((resolve, reject) => {
    const img = new window.Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    img.onload = () => {
      let { width, height } = img;

      if (width > maxSize || height > maxSize) {
        if (width > height) {
          height = Math.round((height * maxSize) / width);
          width = maxSize;
        } else {
          width = Math.round((width * maxSize) / height);
          height = maxSize;
        }
      }

      canvas.width = width;
      canvas.height = height;

      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Could not compress image'));
            return;
          }

          const compressedFile = new File([blob], file.name, {
            type: 'image/png',
            lastModified: Date.now(),
          });

          resolve(compressedFile);
        },
        'image/png',
        0.9
      );
    };

    img.onerror = () => reject(new Error('Could not load image'));

    const reader = new FileReader();
    reader.onload = (e) => {
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
}

const STEPS = [
  { id: 'welcome', title: 'Willkommen', icon: Sparkles },
  { id: 'branding', title: 'Branding', icon: Building2 },
  { id: 'appearance', title: 'Darstellung', icon: Palette },
  { id: 'complete', title: 'Fertig', icon: PartyPopper },
] as const;

type StepId = typeof STEPS[number]['id'];

export default function SetupPage() {
  const router = useRouter();
  const { settings, rawSettings, refreshSettings } = useSettings();

  const [currentStep, setCurrentStep] = useState<StepId>('welcome');
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [appName, setAppName] = useState(settings.app_name);
  const [tagline, setTagline] = useState(settings.tagline);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [primaryColor, setPrimaryColor] = useState(settings.primary_color);

  const logoInputRef = useRef<HTMLInputElement>(null);

  // Apply color immediately when changed in the picker
  useEffect(() => {
    if (primaryColor) {
      const root = document.documentElement;
      root.style.setProperty('--primary', primaryColor);
      root.style.setProperty('--accent', primaryColor);
      root.style.setProperty('--ring', primaryColor);
    }
  }, [primaryColor]);

  const currentStepIndex = STEPS.findIndex(s => s.id === currentStep);
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === STEPS.length - 1;

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const clearLogo = () => {
    setLogoFile(null);
    setLogoPreview(null);
    if (logoInputRef.current) {
      logoInputRef.current.value = '';
    }
  };

  const goNext = () => {
    if (!isLastStep) {
      setCurrentStep(STEPS[currentStepIndex + 1].id);
    }
  };

  const goBack = () => {
    if (!isFirstStep) {
      setCurrentStep(STEPS[currentStepIndex - 1].id);
    }
  };

  const handleComplete = async () => {
    setIsSaving(true);
    try {
      const formData = new FormData();
      formData.append('app_name', appName);
      formData.append('tagline', tagline);
      formData.append('primary_color', primaryColor);
      formData.append('setup_complete', 'true');

      if (logoFile) {
        const compressedLogo = await compressImage(logoFile);
        formData.append('logo', compressedLogo);
      }

      if (rawSettings) {
        await pb.collection('settings').update(rawSettings.id, formData);
      } else {
        // Include defaults when creating new settings record
        formData.append('copyright_holder', settings.copyright_holder);
        formData.append('show_powered_by', String(settings.show_powered_by));
        formData.append('id_format', settings.id_format);
        formData.append('id_padding', String(settings.id_padding));
        formData.append('reservations_enabled', String(settings.reservations_enabled));
        await pb.collection('settings').create(formData);
      }

      await refreshSettings();
      toast.success('Einrichtung abgeschlossen!');
      router.push('/dashboard');
    } catch (error) {
      console.error('Failed to save settings:', error);
      toast.error('Fehler beim Speichern der Einstellungen');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      {/* Progress indicator */}
      <div className="w-full max-w-2xl mb-8">
        <div className="flex items-center justify-between">
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            const isActive = step.id === currentStep;
            const isCompleted = index < currentStepIndex;

            return (
              <div key={step.id} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div
                    className={cn(
                      'w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors',
                      isActive && 'border-primary bg-primary text-primary-foreground',
                      isCompleted && 'border-primary bg-primary/20 text-primary',
                      !isActive && !isCompleted && 'border-muted-foreground/30 text-muted-foreground/50'
                    )}
                  >
                    {isCompleted ? (
                      <Check className="h-5 w-5" />
                    ) : (
                      <Icon className="h-5 w-5" />
                    )}
                  </div>
                  <span className={cn(
                    'text-xs mt-1 font-medium',
                    isActive && 'text-primary',
                    !isActive && 'text-muted-foreground'
                  )}>
                    {step.title}
                  </span>
                </div>
                {index < STEPS.length - 1 && (
                  <div
                    className={cn(
                      'w-16 h-0.5 mx-2',
                      index < currentStepIndex ? 'bg-primary' : 'bg-muted-foreground/30'
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Step content */}
      <Card className="w-full max-w-2xl">
        {currentStep === 'welcome' && (
          <>
            <CardHeader className="text-center">
              <div className="mx-auto mb-4">
                <Image
                  src={`${process.env.NEXT_PUBLIC_BASE_PATH || ''}/smile.svg`}
                  alt="Logo"
                  width={80}
                  height={80}
                  className="h-20 w-20"
                  unoptimized
                />
              </div>
              <CardTitle className="text-2xl">Willkommen bei der Einrichtung</CardTitle>
              <CardDescription className="text-base">
                Richte deine Anwendung in wenigen Schritten ein. Du kannst diese Einstellungen
                später jederzeit in der Konfiguration anpassen.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground">
                <p className="font-medium text-foreground mb-2">Was erwartet dich:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Wähle einen Namen für deine Anwendung</li>
                  <li>Lade optional ein eigenes Logo hoch</li>
                  <li>Passe die Akzentfarbe an</li>
                </ul>
              </div>
            </CardContent>
          </>
        )}

        {currentStep === 'branding' && (
          <>
            <CardHeader>
              <CardTitle>Branding</CardTitle>
              <CardDescription>
                Gib deiner Anwendung einen Namen und ein Logo.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="app-name">Anwendungsname</Label>
                <Input
                  id="app-name"
                  value={appName}
                  onChange={(e) => setAppName(e.target.value)}
                  placeholder="z.B. BiblioBorrow, Leihothek, ..."
                />
                <p className="text-xs text-muted-foreground">
                  Wird in der Navigation und im Browser-Tab angezeigt.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="tagline">Untertitel (optional)</Label>
                <Input
                  id="tagline"
                  value={tagline}
                  onChange={(e) => setTagline(e.target.value)}
                  placeholder="z.B. Verwaltungssoftware"
                />
              </div>

              <div className="space-y-2">
                <Label>Logo (optional)</Label>
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-20 h-20 border-2 border-dashed rounded-lg flex items-center justify-center bg-muted">
                    {logoPreview ? (
                      <img src={logoPreview} alt="Logo Vorschau" className="w-full h-full object-contain rounded-lg" />
                    ) : (
                      <Building2 className="w-8 h-8 text-muted-foreground" />
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
                        Hochladen
                      </Button>
                      {logoPreview && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={clearLogo}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      PNG oder SVG empfohlen, min. 40x40px
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </>
        )}

        {currentStep === 'appearance' && (
          <>
            <CardHeader>
              <CardTitle>Darstellung</CardTitle>
              <CardDescription>
                Wähle eine Akzentfarbe für deine Anwendung.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <Label>Akzentfarbe</Label>
                <ColorPicker
                  value={primaryColor}
                  onChange={setPrimaryColor}
                />
                <p className="text-xs text-muted-foreground">
                  Diese Farbe wird für Buttons, Links und Hervorhebungen verwendet.
                </p>
              </div>

              {/* Live preview */}
              <div className="border rounded-lg p-4 space-y-3">
                <p className="text-sm font-medium">Vorschau</p>
                <div className="flex items-center gap-3">
                  <Button
                    style={{ backgroundColor: primaryColor }}
                    className="text-white"
                  >
                    Primärer Button
                  </Button>
                  <Button variant="outline" style={{ borderColor: primaryColor, color: primaryColor }}>
                    Sekundärer Button
                  </Button>
                </div>
                <div
                  className="h-2 rounded-full"
                  style={{ backgroundColor: primaryColor }}
                />
              </div>
            </CardContent>
          </>
        )}

        {currentStep === 'complete' && (
          <>
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                <Check className="h-8 w-8 text-green-600" />
              </div>
              <CardTitle className="text-2xl">Alles bereit!</CardTitle>
              <CardDescription className="text-base">
                Deine Anwendung ist eingerichtet und einsatzbereit.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-4">
                <p className="font-medium mb-2">Zusammenfassung:</p>
                <dl className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Name:</dt>
                    <dd className="font-medium">{appName || 'leih.lokal'}</dd>
                  </div>
                  {tagline && (
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Untertitel:</dt>
                      <dd className="font-medium">{tagline}</dd>
                    </div>
                  )}
                  <div className="flex justify-between items-center">
                    <dt className="text-muted-foreground">Akzentfarbe:</dt>
                    <dd className="flex items-center gap-2">
                      <div
                        className="w-4 h-4 rounded-full border"
                        style={{ backgroundColor: primaryColor }}
                      />
                    </dd>
                  </div>
                  <div className="flex justify-between items-center">
                    <dt className="text-muted-foreground">Logo:</dt>
                    <dd>{logoFile ? 'Hochgeladen' : 'Standard'}</dd>
                  </div>
                </dl>
              </div>

              <p className="text-sm text-muted-foreground text-center">
                Du kannst diese Einstellungen jederzeit unter Konfiguration ändern.
              </p>
            </CardContent>
          </>
        )}

        {/* Navigation buttons */}
        <div className="flex justify-between p-6 pt-0">
          <Button
            variant="ghost"
            onClick={goBack}
            disabled={isFirstStep}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Zurück
          </Button>

          {isLastStep ? (
            <Button onClick={handleComplete} disabled={isSaving}>
              {isSaving ? 'Speichert...' : 'Einrichtung abschließen'}
            </Button>
          ) : (
            <Button onClick={goNext}>
              Weiter
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
      </Card>

      {/* Skip link */}
      {!isLastStep && (
        <button
          onClick={() => setCurrentStep('complete')}
          className="mt-4 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Einrichtung überspringen
        </button>
      )}
    </div>
  );
}
