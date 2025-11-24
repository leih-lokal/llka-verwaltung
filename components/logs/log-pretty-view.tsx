/**
 * Pretty view component for REST request logs
 */

'use client';

import { Eye, EyeOff } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { LogEntry } from '@/types';
import {
  parseRestRequestMessage,
  extractStatusCode,
  formatQueryParams,
  getStatusCodeColor,
  generateRequestTitle,
} from '@/lib/utils/log-parser';

interface LogPrettyViewProps {
  log: LogEntry;
  onToggle: () => void;
}

export function LogPrettyView({ log, onToggle }: LogPrettyViewProps) {
  const parsed = parseRestRequestMessage(log.message);
  const { statusCode, statusText } = extractStatusCode(log.data, log.message);
  const title = generateRequestTitle(log.data?.method || '', parsed.endpoint, statusCode);

  return (
    <div className="space-y-1.5">
      {/* Toggle button + Method badge + Title */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0"
          onClick={onToggle}
          title="Rohe Nachricht anzeigen"
        >
          <Eye className="h-3.5 w-3.5" />
        </Button>

        {log.data?.method && (
          <Badge
            variant="outline"
            className="font-mono text-xs"
          >
            {log.data.method}
          </Badge>
        )}

        <span className="text-sm font-semibold text-foreground">
          {title}
        </span>
      </div>

      {/* Endpoint */}
      <div className="flex items-start gap-2">
        <span className="text-xs text-muted-foreground font-medium min-w-[70px]">
          Endpoint:
        </span>
        <span className="text-sm font-mono break-all">
          {parsed.endpoint}
        </span>
      </div>

      {/* Query Parameters */}
      {parsed.queryString && (
        <div className="flex items-start gap-2">
          <span className="text-xs text-muted-foreground font-medium min-w-[70px]">
            Params:
          </span>
          <span className="text-sm font-mono text-muted-foreground break-all">
            {formatQueryParams(parsed.queryParams, 60)}
          </span>
        </div>
      )}

      {/* Status Code */}
      {statusCode && (
        <div className="flex items-start gap-2">
          <span className="text-xs text-muted-foreground font-medium min-w-[70px]">
            Status:
          </span>
          <span className={`text-sm font-mono font-medium ${getStatusCodeColor(statusCode)}`}>
            {statusCode} {statusText}
          </span>
        </div>
      )}
    </div>
  );
}

interface LogRawViewProps {
  log: LogEntry;
  onToggle: () => void;
}

export function LogRawView({ log, onToggle }: LogRawViewProps) {
  return (
    <div className="flex items-start gap-2">
      <Button
        variant="ghost"
        size="sm"
        className="h-6 w-6 p-0 flex-shrink-0"
        onClick={onToggle}
        title="Formatierte Ansicht anzeigen"
      >
        <EyeOff className="h-3.5 w-3.5" />
      </Button>
      <span className="text-sm font-mono break-words">
        {log.message}
      </span>
    </div>
  );
}
