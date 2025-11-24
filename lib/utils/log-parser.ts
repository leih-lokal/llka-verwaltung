/**
 * Utility functions for parsing log entries
 */

import type { LogEntry } from '@/types';

export interface ParsedRestRequest {
  endpoint: string;
  queryParams: Record<string, string>;
  queryString: string;
  statusCode?: number;
  statusText?: string;
  title?: string;
}

/**
 * Check if a log entry is a REST request
 */
export function isRestRequest(log: LogEntry): boolean {
  return !!(log.data?.method && log.data?.type === 'request');
}

/**
 * Parse REST request message to extract endpoint and query parameters
 * Example: "GET /api/collections/customer?page=1&perPage=50"
 *   → { endpoint: "/api/collections/customer", queryParams: { page: "1", perPage: "50" } }
 */
export function parseRestRequestMessage(message: string): ParsedRestRequest {
  const result: ParsedRestRequest = {
    endpoint: '',
    queryParams: {},
    queryString: '',
  };

  try {
    // Extract the URL part after the HTTP method
    // Pattern: "METHOD /path?query"
    const urlMatch = message.match(/^[A-Z]+\s+(.+?)(?:\s|$)/);
    if (!urlMatch) {
      result.endpoint = message;
      return result;
    }

    const urlPart = urlMatch[1];

    // Split endpoint and query string
    const [endpoint, queryString] = urlPart.split('?');
    result.endpoint = endpoint;
    result.queryString = queryString || '';

    // Parse query parameters
    if (queryString) {
      const params = new URLSearchParams(queryString);
      params.forEach((value, key) => {
        result.queryParams[key] = value;
      });
    }
  } catch (error) {
    console.error('Error parsing REST request message:', error);
    result.endpoint = message;
  }

  return result;
}

/**
 * Extract status code from log data or message
 * Looks for patterns like "200", "404 Not Found", etc.
 */
export function extractStatusCode(
  data: LogEntry['data'],
  message: string
): { statusCode?: number; statusText?: string } {
  // Check data object first
  if (data && typeof data === 'object') {
    // Try common field names
    const statusFromData =
      (data as any).status ||
      (data as any).statusCode ||
      (data as any).code;

    if (typeof statusFromData === 'number') {
      return {
        statusCode: statusFromData,
        statusText: getStatusText(statusFromData),
      };
    }
  }

  // Try to extract from message
  // Look for patterns like "200", "404 Not Found", etc.
  const statusMatch = message.match(/\b([1-5]\d{2})\b/);
  if (statusMatch) {
    const code = parseInt(statusMatch[1], 10);
    return {
      statusCode: code,
      statusText: getStatusText(code),
    };
  }

  return {};
}

/**
 * Get human-readable status text for HTTP status codes
 */
function getStatusText(code: number): string {
  const statusTexts: Record<number, string> = {
    200: 'OK',
    201: 'Created',
    204: 'No Content',
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    409: 'Conflict',
    422: 'Unprocessable Entity',
    500: 'Internal Server Error',
    502: 'Bad Gateway',
    503: 'Service Unavailable',
  };

  return statusTexts[code] || '';
}

/**
 * Get variant for status code badge
 */
export function getStatusCodeVariant(code: number): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (code >= 200 && code < 300) return 'default';
  if (code >= 300 && code < 400) return 'secondary';
  if (code >= 400 && code < 500) return 'destructive';
  if (code >= 500) return 'destructive';
  return 'outline';
}

/**
 * Get color class for status code
 */
export function getStatusCodeColor(code: number): string {
  if (code >= 200 && code < 300) return 'text-green-600';
  if (code >= 300 && code < 400) return 'text-yellow-600';
  if (code >= 400 && code < 500) return 'text-orange-600';
  if (code >= 500) return 'text-red-600';
  return 'text-gray-600';
}

/**
 * Format query parameters for display
 * Truncates long values and shows count if many params
 */
export function formatQueryParams(params: Record<string, string>, maxLength = 50): string {
  const entries = Object.entries(params);

  if (entries.length === 0) {
    return 'Keine';
  }

  const formatted = entries.map(([key, value]) => {
    const truncated = value.length > maxLength
      ? value.substring(0, maxLength) + '...'
      : value;
    return `${key}=${truncated}`;
  });

  return formatted.join(', ');
}

/**
 * Generate a human-readable title for a REST request based on context
 */
export function generateRequestTitle(
  method: string,
  endpoint: string,
  statusCode?: number
): string {
  const isSuccess = statusCode && statusCode >= 200 && statusCode < 300;
  const isError = statusCode && statusCode >= 400;

  // Auth endpoints
  if (endpoint.includes('/auth-refresh') || endpoint.includes('auth-refresh')) {
    return isSuccess ? 'PocketBase-Autorisierung Aktualisiert' : 'Autorisierung Aktualisierung Fehlgeschlagen';
  }
  if (endpoint.includes('/auth-with-password') || endpoint.includes('auth-with-password')) {
    return isSuccess ? 'Benutzer Angemeldet' : 'Anmeldung Fehlgeschlagen';
  }
  if (endpoint.includes('/request-verification')) {
    return 'Verifizierung Angefordert';
  }
  if (endpoint.includes('/confirm-verification')) {
    return isSuccess ? 'E-Mail Verifiziert' : 'Verifizierung Fehlgeschlagen';
  }

  // Collection operations
  const collectionMatch = endpoint.match(/\/api\/collections\/(\w+)/);
  if (collectionMatch) {
    const collection = collectionMatch[1];
    const collectionName = getCollectionDisplayName(collection);

    // Check if it's a records endpoint
    if (endpoint.includes('/records')) {
      // Single record operations (has ID after /records/)
      const recordIdMatch = endpoint.match(/\/records\/([a-zA-Z0-9]+)/);

      if (recordIdMatch) {
        // Operations on specific record
        switch (method) {
          case 'GET':
            return `${collectionName} Abgerufen`;
          case 'PATCH':
          case 'PUT':
            return isSuccess ? `${collectionName} Aktualisiert` : `${collectionName} Aktualisierung Fehlgeschlagen`;
          case 'DELETE':
            return isSuccess ? `${collectionName} Gelöscht` : `${collectionName} Löschung Fehlgeschlagen`;
          default:
            return `${collectionName} ${method}`;
        }
      } else {
        // List/Create operations
        switch (method) {
          case 'GET':
            return `${collectionName}-Liste Abgerufen`;
          case 'POST':
            return isSuccess ? `${collectionName} Erstellt` : `${collectionName} Erstellung Fehlgeschlagen`;
          default:
            return `${collectionName} ${method}`;
        }
      }
    }

    return `${collectionName} ${method}`;
  }

  // Logs endpoint
  if (endpoint.includes('/api/logs')) {
    return 'Protokolle Abgerufen';
  }

  // Realtime/subscriptions
  if (endpoint.includes('/realtime') || endpoint.includes('/subscribe')) {
    return 'Echtzeit-Verbindung Aufgebaut';
  }

  // Files/storage
  if (endpoint.includes('/files/') || endpoint.includes('/api/files')) {
    switch (method) {
      case 'GET':
        return 'Datei Abgerufen';
      case 'POST':
        return isSuccess ? 'Datei Hochgeladen' : 'Datei-Upload Fehlgeschlagen';
      case 'DELETE':
        return isSuccess ? 'Datei Gelöscht' : 'Datei-Löschung Fehlgeschlagen';
      default:
        return `Datei ${method}`;
    }
  }

  // Generic fallback based on method and status
  if (isError) {
    return `${method}-Anfrage Fehlgeschlagen`;
  }

  return `${method} Anfrage`;
}

/**
 * Get display name for PocketBase collection
 */
function getCollectionDisplayName(collection: string): string {
  const displayNames: Record<string, string> = {
    'customer': 'Nutzer',
    'customers': 'Nutzer',
    'item': 'Gegenstand',
    'items': 'Gegenstände',
    'rental': 'Ausleihe',
    'rentals': 'Ausleihen',
    'reservation': 'Reservierung',
    'reservations': 'Reservierungen',
    'note': 'Notiz',
    'notes': 'Notiz',
    'log': 'Protokoll',
    'logs': 'Protokoll',
    'users': 'Benutzer',
    'user': 'Benutzer',
  };

  return displayNames[collection.toLowerCase()] || collection;
}
