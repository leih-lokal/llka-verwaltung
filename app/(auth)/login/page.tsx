/**
 * Login page - Jazzed Up Version
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
  CardFooter,
} from '@/components/ui/card';
import { toast } from 'sonner';
import { LogIn, Server, User, Lock, ArrowRight, Activity } from 'lucide-react';
import { getServerUrl } from '@/lib/pocketbase/client';

export default function LoginPage() {
  const router = useRouter();
  const { login, isAuthenticated } = useAuth();
  const defaultPlaceholderUrl = getServerUrl();
  const [serverUrl, setServerUrl] = useState(defaultPlaceholderUrl);
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
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-slate-50 p-4 dark:bg-slate-950">
      
      {/* Background Decor - Optional: Requires Tailwind Config for specialized gradients, using standard here */}
      <div className="absolute inset-0 z-0 h-full w-full bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] [mask-image:radial-gradient(ellipse_50%_50%_at_50%_50%,#000_70%,transparent_100%)] dark:bg-[radial-gradient(#1f2937_1px,transparent_1px)]"></div>
      <div className="absolute left-[-20%] top-[-10%] z-0 h-[500px] w-[500px] rounded-full bg-primary/20 blur-[100px]" />
      <div className="absolute bottom-[-10%] right-[-20%] z-0 h-[500px] w-[500px] rounded-full bg-blue-500/20 blur-[100px]" />

      <Card className="z-10 w-full max-w-md border border-slate-200 bg-white/80 shadow-2xl backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/80">
        <CardHeader className="space-y-3 text-center pb-2">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/60 shadow-lg text-primary-foreground">
            <LogIn className="h-7 w-7" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold tracking-tight">leih.lokal</CardTitle>
            <CardDescription className="text-base font-medium text-muted-foreground">
              Verwaltungszugang
            </CardDescription>
          </div>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Slot 1: Server URL */}
            <div className="space-y-2">
              <Label htmlFor="serverUrl" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Server Umgebung
              </Label>
              <div className="relative group">
                <div className="absolute left-3 top-2.5 text-muted-foreground transition-colors group-focus-within:text-primary">
                  <Server className="h-5 w-5" />
                </div>
                <Input
                  id="serverUrl"
                  type="url"
                  placeholder="https://leihlokal.de"
                  className="pl-10 h-11 transition-all border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-primary/20 dark:bg-slate-900 dark:focus:bg-slate-950"
                  value={serverUrl}
                  onChange={(e) => setServerUrl(e.target.value)}
                  disabled={isLoading}
                  autoComplete="url"
                  autoFocus
                />
                <div className="absolute right-3 top-3 h-2 w-2 rounded-full bg-green-500 animate-pulse" title="Server Status Check (Visual Only)" />
              </div>
            </div>

            {/* Slot 2: Username */}
            <div className="space-y-2">
              <Label htmlFor="username" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Benutzername
              </Label>
              <div className="relative group">
                <div className="absolute left-3 top-2.5 text-muted-foreground transition-colors group-focus-within:text-primary">
                  <User className="h-5 w-5" />
                </div>
                <Input
                  id="username"
                  type="text"
                  placeholder="admin@leihlokal.de"
                  className="pl-10 h-11 transition-all border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-primary/20 dark:bg-slate-900 dark:focus:bg-slate-950"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={isLoading}
                  autoComplete="username"
                />
              </div>
            </div>

            {/* Slot 3: Password */}
            <div className="space-y-2">
              <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Passwort
              </Label>
              <div className="relative group">
                <div className="absolute left-3 top-2.5 text-muted-foreground transition-colors group-focus-within:text-primary">
                  <Lock className="h-5 w-5" />
                </div>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  className="pl-10 h-11 transition-all border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-primary/20 dark:bg-slate-900 dark:focus:bg-slate-950"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  autoComplete="current-password"
                />
              </div>
            </div>

            <Button 
              type="submit" 
              className="group w-full h-11 text-base font-semibold shadow-md transition-all hover:scale-[1.01]" 
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Activity className="mr-2 h-4 w-4 animate-spin" />
                  Verbinde...
                </>
              ) : (
                <>
                  Anmelden
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </>
              )}
            </Button>
          </form>
        </CardContent>

      </Card>
      
      <div className="mt-8 text-center text-xs text-muted-foreground opacity-50">
        &copy; {new Date().getFullYear()} Bürgerstiftung Karlsruhe
      </div>
    </div>
  );
}