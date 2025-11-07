/**
 * Dashboard home page
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LayoutDashboard } from 'lucide-react';

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LayoutDashboard className="h-5 w-5" />
            <span>Dashboard wird bald verfügbar sein</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Hier werden Statistiken, Notizen und wichtige Informationen
            angezeigt.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
