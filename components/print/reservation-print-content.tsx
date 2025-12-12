/**
 * Reservation Print Content Component
 * Generates the HTML content for printing today's reservations checklist
 * Follows print standards: no fills, borders/outlines only, proper margins
 */

import { formatDate, formatDateTime } from '@/lib/utils/formatting';
import type { ReservationExpanded } from '@/types';

/**
 * Generates HTML content for printing reservations checklist
 */
export function generateReservationPrintContent(
  reservations: ReservationExpanded[]
): string {
  const today = formatDate(new Date());

  // Generate HTML for each reservation - compact single-line format
  const reservationsHtml = reservations
    .map((reservation) => {
      const itemCount = reservation.items?.length || 0;
      const firstItem = reservation.expand?.items?.[0];
      const itemsText = firstItem
        ? `${String(firstItem.iid).padStart(4, '0')} ${firstItem.name}${itemCount > 1 ? ` +${itemCount - 1}` : ''}`
        : `${itemCount} ${itemCount === 1 ? 'Gegenstand' : 'Gegenstände'}`;

      return `
        <div style="display: flex; align-items: center; gap: 0.75rem; padding: 0.5rem; border-bottom: 1px solid #ddd; page-break-inside: avoid;">
          <input type="checkbox" style="width: 16px; height: 16px; margin: 0;" />

          <div style="min-width: 160px; font-weight: 600;">
            ${reservation.customer_name}
            ${
              reservation.is_new_customer
                ? ` <span style="font-size: 8pt; padding: 0.125rem 0.375rem; background-color: #f3f4f6; border: 1px solid #999; border-radius: 0.25rem; font-weight: normal;">Neu</span>`
                : ''
            }
          </div>

          ${
            reservation.otp
              ? `<div style="border: 1px solid #dc2626; background-color: #fee; border-radius: 0.25rem; padding: 0.25rem 0.5rem;">
                  <span style="font-family: 'Courier New', Courier, monospace; font-weight: 700; color: #dc2626; letter-spacing: 0.1em;">
                    ${reservation.otp}
                  </span>
                </div>`
              : ''
          }

          <div style="flex: 1; color: #666;">
            ${itemsText}
          </div>

          ${
            reservation.comments
              ? `<div style="color: #666;" title="${reservation.comments.replace(/"/g, '&quot;')}">💬</div>`
              : ''
          }
        </div>
      `;
    })
    .join('');

  const emptyMessage =
    reservations.length === 0
      ? '<p style="color: #6b7280;">Keine Reservierungen für heute geplant.</p>'
      : '';

  const printTimestamp = new Date().toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return `
    <!DOCTYPE html>
    <html lang="de">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Heutige Reservierungen - ${today}</title>
      <style>
        @page {
          size: A4;
          margin: 15mm;
        }

        * {
          box-sizing: border-box;
        }

        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          font-size: 10pt;
          line-height: 1.4;
          color: #000;
          margin: 0;
          padding: 0;
        }

        @media print {
          input[type="checkbox"] {
            -webkit-appearance: checkbox;
            -moz-appearance: checkbox;
            appearance: checkbox;
          }
        }
      </style>
    </head>
    <body>
      <div style="margin-bottom: 1rem; border-bottom: 2px solid #000; padding-bottom: 0.5rem;">
        <h1 style="font-size: 16pt; font-weight: 700; margin: 0;">
          Heutige Reservierungen
        </h1>
        <p style="font-size: 9pt; color: #666; margin: 0.25rem 0 0 0;">${today}</p>
      </div>

      <div>
        ${reservationsHtml}
        ${emptyMessage}
      </div>

      <div style="margin-top: 1.5rem; padding-top: 0.5rem; border-top: 1px solid #ddd;">
        <p style="font-size: 8pt; color: #999; margin: 0;">
          Gedruckt am ${printTimestamp}
        </p>
      </div>
    </body>
    </html>
  `;
}
