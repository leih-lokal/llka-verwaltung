/**
 * Customer Print Content Component
 * Generates the HTML content for printing customer details
 * Follows print standards: no fills, borders/outlines only, proper margins
 */

import { formatDate, formatCurrency } from '@/lib/utils/formatting';
import type { Customer, RentalExpanded, ReservationExpanded } from '@/types';
import { calculateRentalStatus } from '@/lib/utils/formatting';
import { getRentalStatusLabel } from '@/lib/constants/statuses';

interface CustomerPrintContentProps {
  customer: Customer;
  rentals: RentalExpanded[];
  reservations: ReservationExpanded[];
}

export function generateCustomerPrintContent({
  customer,
  rentals,
  reservations,
}: CustomerPrintContentProps): string {
  const activeRentals = rentals.filter(r => !r.returned_on);
  const overdueRentals = activeRentals.filter(r => {
    const status = calculateRentalStatus(r.rented_on, r.returned_on, r.expected_on, r.extended_on);
    return status === 'overdue';
  });
  const openReservations = reservations.filter(r => !r.done);

  // Generate active rentals HTML
  const activeRentalsHtml = activeRentals.length > 0 ? activeRentals.map((rental) => {
    const status = calculateRentalStatus(
      rental.rented_on,
      rental.returned_on,
      rental.expected_on,
      rental.extended_on
    );
    const itemCount = rental.expand?.items?.length || 0;

    return `
      <tr>
        <td style="padding: 8px 10px; border-bottom: 1px solid #333;">
          ${formatDate(rental.rented_on)}
        </td>
        <td style="padding: 8px 10px; border-bottom: 1px solid #333;">
          ${formatDate(rental.expected_on)}
        </td>
        <td style="padding: 8px 10px; border-bottom: 1px solid #333; text-align: center;">
          ${itemCount} Artikel
        </td>
        <td style="padding: 8px 10px; border-bottom: 1px solid #333;">
          <strong ${status === 'overdue' ? 'style="color: #d32f2f;"' : ''}>${getRentalStatusLabel(status)}</strong>
        </td>
      </tr>
    `;
  }).join('') : '<tr><td colspan="4" style="padding: 12px; text-align: center; color: #666;">Keine aktiven Leihvorgänge</td></tr>';

  // Generate open reservations HTML
  const openReservationsHtml = openReservations.length > 0 ? openReservations.map((reservation) => {
    const items = reservation.expand?.items || [];
    const firstItem = items[0];
    const additionalCount = items.length - 1;

    return `
      <tr>
        <td style="padding: 8px 10px; border-bottom: 1px solid #333;">
          ${formatDate(reservation.pickup)}
        </td>
        <td style="padding: 8px 10px; border-bottom: 1px solid #333;">
          ${firstItem ? `
            <span style="font-family: monospace; font-weight: 600;">#${String(firstItem.iid).padStart(4, '0')}</span>
            ${firstItem.name}
            ${additionalCount > 0 ? `<span style="font-size: 0.9em;"> +${additionalCount}</span>` : ''}
          ` : '—'}
        </td>
        <td style="padding: 8px 10px; border-bottom: 1px solid #333;">
          ${reservation.comments || '—'}
        </td>
      </tr>
    `;
  }).join('') : '<tr><td colspan="3" style="padding: 12px; text-align: center; color: #666;">Keine offenen Reservierungen</td></tr>';

  // Generate rental history HTML
  const rentalHistoryHtml = rentals.length > 0 ? rentals.slice(0, 10).map((rental) => {
    const status = calculateRentalStatus(
      rental.rented_on,
      rental.returned_on,
      rental.expected_on,
      rental.extended_on
    );
    const itemCount = rental.expand?.items?.length || 0;

    return `
      <tr>
        <td style="padding: 6px 10px; border-bottom: 1px solid #ddd; font-size: 10pt;">
          ${formatDate(rental.rented_on)}
        </td>
        <td style="padding: 6px 10px; border-bottom: 1px solid #ddd; font-size: 10pt;">
          ${rental.returned_on ? formatDate(rental.returned_on) : '—'}
        </td>
        <td style="padding: 6px 10px; border-bottom: 1px solid #ddd; text-align: center; font-size: 10pt;">
          ${itemCount}
        </td>
        <td style="padding: 6px 10px; border-bottom: 1px solid #ddd; font-size: 10pt;">
          ${getRentalStatusLabel(status)}
        </td>
      </tr>
    `;
  }).join('') : '<tr><td colspan="4" style="padding: 12px; text-align: center; color: #666; font-size: 10pt;">Keine Leihvorgänge</td></tr>';

  return `
    <!DOCTYPE html>
    <html lang="de">
    <head>
      <meta charset="UTF-8">
      <title>Nutzerdetails - ${customer.firstname} ${customer.lastname}</title>
      <style>
        * {
          box-sizing: border-box;
        }

        @page {
          margin: 20mm;
          size: A4;
        }

        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          line-height: 1.5;
          color: #000;
          max-width: 100%;
          margin: 0;
          padding: 0;
          font-size: 11pt;
        }

        .header {
          text-align: center;
          border-bottom: 2px solid #000;
          padding-bottom: 15px;
          margin-bottom: 20px;
        }

        .header h1 {
          margin: 0 0 5px 0;
          font-size: 22pt;
          font-weight: bold;
        }

        .header .subtitle {
          font-size: 10pt;
        }

        .section {
          margin-bottom: 18px;
          page-break-inside: avoid;
        }

        .section-title {
          font-size: 11pt;
          font-weight: 600;
          border-bottom: 1px solid #000;
          padding-bottom: 5px;
          margin-bottom: 10px;
        }

        .customer-box {
          border: 2px solid #000;
          padding: 12px;
          margin-bottom: 15px;
        }

        .customer-id {
          font-family: monospace;
          font-weight: 600;
          font-size: 12pt;
        }

        .customer-name {
          font-size: 14pt;
          font-weight: 600;
          margin: 5px 0;
        }

        .customer-details {
          font-size: 10pt;
          margin-top: 8px;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
          margin-bottom: 15px;
        }

        .stat-box {
          border: 1px solid #333;
          padding: 10px;
          text-align: center;
        }

        .stat-label {
          font-size: 9pt;
          margin-bottom: 3px;
        }

        .stat-value {
          font-weight: 600;
          font-size: 18pt;
        }

        .info-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }

        .info-item {
          display: flex;
          padding: 6px 0;
        }

        .info-label {
          font-size: 9pt;
          font-weight: 600;
          width: 130px;
          flex-shrink: 0;
        }

        .info-value {
          font-size: 10pt;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 8px;
        }

        th {
          padding: 8px 10px;
          text-align: left;
          font-weight: 600;
          font-size: 10pt;
          border-top: 2px solid #000;
          border-bottom: 2px solid #000;
        }

        th:last-child {
          text-align: right;
        }

        .alert-box {
          border: 2px solid #d32f2f;
          background: #fff;
          padding: 10px;
          margin-bottom: 15px;
        }

        .alert-title {
          font-weight: 600;
          margin-bottom: 5px;
          font-size: 11pt;
        }

        .note-box {
          border: 1px solid #000;
          padding: 10px;
          margin-top: 8px;
        }

        .note-label {
          font-weight: 600;
          margin-bottom: 5px;
        }

        .footer {
          margin-top: 25px;
          padding-top: 12px;
          border-top: 1px solid #000;
          text-align: center;
          font-size: 9pt;
        }

        @media print {
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          .no-print {
            display: none;
          }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Nutzerdetails</h1>
        <div class="subtitle">leih.lokal Karlsruhe</div>
      </div>

      <div class="section">
        <div class="customer-box">
          <div class="customer-id">#${String(customer.iid).padStart(4, '0')}</div>
          <div class="customer-name">${customer.firstname} ${customer.lastname}</div>
          <div class="customer-details">
            ${customer.email ? `📧 ${customer.email}<br>` : ''}
            ${customer.phone ? `📞 ${customer.phone}<br>` : ''}
            ${customer.street ? `📍 ${customer.street}, ${customer.postal_code} ${customer.city}` : ''}
          </div>
        </div>

        <div class="stats-grid">
          <div class="stat-box">
            <div class="stat-label">Aktive Leihvorgänge</div>
            <div class="stat-value">${activeRentals.length}</div>
          </div>
          <div class="stat-box">
            <div class="stat-label">Gesamt Ausleihen</div>
            <div class="stat-value">${rentals.length}</div>
          </div>
          <div class="stat-box">
            <div class="stat-label">Offene Reservierungen</div>
            <div class="stat-value">${openReservations.length}</div>
          </div>
        </div>
      </div>

      ${overdueRentals.length > 0 ? `
        <div class="section">
          <div class="alert-box">
            <div class="alert-title">⚠️ Überfällige Leihvorgänge: ${overdueRentals.length}</div>
            <div>Dieser Nutzer hat überfällige Rückgaben. Bitte kontaktieren.</div>
          </div>
        </div>
      ` : ''}

      ${customer.remark ? `
        <div class="section">
          <div class="note-box">
            <div class="note-label">⚠️ Wichtige Bemerkung:</div>
            <div>${customer.remark}</div>
          </div>
        </div>
      ` : ''}

      <div class="section">
        <div class="section-title">Nutzerinformation</div>
        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">Registriert am:</span>
            <span class="info-value">${formatDate(customer.registered_on)}</span>
          </div>
          ${customer.renewed_on ? `
            <div class="info-item">
              <span class="info-label">Verlängert am:</span>
              <span class="info-value">${formatDate(customer.renewed_on)}</span>
            </div>
          ` : ''}
          <div class="info-item">
            <span class="info-label">Newsletter:</span>
            <span class="info-value">${customer.newsletter ? 'Ja' : 'Nein'}</span>
          </div>
        </div>
      </div>

      ${activeRentals.length > 0 ? `
        <div class="section">
          <div class="section-title">Aktive Leihvorgänge (${activeRentals.length})</div>
          <table>
            <thead>
              <tr>
                <th>Ausgeliehen</th>
                <th>Zurückerwartet</th>
                <th style="text-align: center;">Artikel</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${activeRentalsHtml}
            </tbody>
          </table>
        </div>
      ` : ''}

      ${openReservations.length > 0 ? `
        <div class="section">
          <div class="section-title">Offene Reservierungen (${openReservations.length})</div>
          <table>
            <thead>
              <tr>
                <th>Abholung</th>
                <th>Artikel</th>
                <th>Kommentar</th>
              </tr>
            </thead>
            <tbody>
              ${openReservationsHtml}
            </tbody>
          </table>
        </div>
      ` : ''}

      ${rentals.length > 0 ? `
        <div class="section">
          <div class="section-title">Leihverlauf (letzte 10)</div>
          <table>
            <thead>
              <tr>
                <th style="font-size: 9pt;">Ausgeliehen</th>
                <th style="font-size: 9pt;">Zurückgegeben</th>
                <th style="text-align: center; font-size: 9pt;">Artikel</th>
                <th style="font-size: 9pt;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${rentalHistoryHtml}
            </tbody>
          </table>
          ${rentals.length > 10 ? `<p style="font-size: 9pt; text-align: center; margin-top: 8px;">Zeigt die letzten 10 von ${rentals.length} Leihvorgängen</p>` : ''}
        </div>
      ` : ''}

      <div class="footer">
        <p>Gedruckt am ${new Date().toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
        <p>Dies ist ein internes Dokument und dient nur zur Information.</p>
      </div>
    </body>
    </html>
  `;
}
