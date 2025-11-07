/**
 * Login page
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { toast } from 'sonner';
import { LogIn } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { login, isAuthenticated } = useAuth();
  const [serverUrl, setServerUrl] = useState('http://localhost:8090');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Load stored server URL on mount
  useEffect(() => {
    const storedUrl = localStorage.getItem('pocketbase_url');
    if (storedUrl) {
      setServerUrl(storedUrl);
    }
  }, []);

  // Redirect if already authenticated
  if (isAuthenticated) {
    router.push('/dashboard');
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!serverUrl || !username || !password) {
      toast.error('Bitte füllen Sie alle Felder aus');
      return;
    }

    // Validate URL format
    try {
      new URL(serverUrl);
    } catch {
      toast.error('Bitte geben Sie eine gültige Server-URL ein');
      return;
    }

    setIsLoading(true);

    // Store server URL in localStorage before login
    localStorage.setItem('pocketbase_url', serverUrl);

    const result = await login(username, password);

    if (result.success) {
      toast.success('Erfolgreich angemeldet');
      router.push('/dashboard');
    } else {
      toast.error(result.error || 'Anmeldung fehlgeschlagen');
    }

    setIsLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border-2 border-primary">
        <CardHeader className="text-center border-b-2 border-primary bg-primary/5">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center bg-primary text-primary-foreground">
            <LogIn className="h-6 w-6" />
          </div>
          <CardTitle className="text-2xl font-bold">LeihLokal Verwaltung</CardTitle>
          <CardDescription className="text-foreground/70">
            Melden Sie sich an, um fortzufahren
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="serverUrl">PocketBase Server-URL</Label>
              <Input
                id="serverUrl"
                type="url"
                placeholder="http://localhost:8090"
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
                disabled={isLoading}
                autoComplete="url"
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                z.B. http://localhost:8090 oder https://api.leihlokal.de
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="username">Benutzername</Label>
              <Input
                id="username"
                type="text"
                placeholder="admin@leihlokal.de"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={isLoading}
                autoComplete="username"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Passwort</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                autoComplete="current-password"
              />
            </div>

            <Button type="submit" className="w-full font-bold" disabled={isLoading}>
              {isLoading ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin border-2 border-background border-t-transparent" />
                  Anmelden...
                </>
              ) : (
                'Anmelden'
              )}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-muted-foreground border-t-2 border-primary pt-4">
            <p>
              Verwenden Sie die Admin-Anmeldedaten aus Ihrer PocketBase-Installation
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
