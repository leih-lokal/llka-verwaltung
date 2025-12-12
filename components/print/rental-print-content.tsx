/**
 * Rental Print Content Component
 * Generates the HTML content for printing a rental receipt
 * Follows print standards: no fills, borders/outlines only, proper margins
 */

import { formatCurrency } from '@/lib/utils/formatting';
import { localStringToDate } from '@/lib/utils/formatting';
import { getCopyCount, type InstanceData } from '@/lib/utils/instance-data';
import { getReturnedCopyCount } from '@/lib/utils/partial-returns';
import type { RentalExpanded, Customer, Item } from '@/types';

interface RentalPrintContentProps {
  rental: RentalExpanded;
  customer: Customer;
  items: Item[];
  instanceData: InstanceData;
  deposit: number;
}

// Format date for print display
function formatPrintDate(dateStr: string | undefined): string {
  if (!dateStr) return '-';
  try {
    const date = localStringToDate(dateStr.split(/[T\s]/)[0]);
    return date.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

export function generateRentalPrintContent({
  rental,
  customer,
  items,
  instanceData,
  deposit,
}: RentalPrintContentProps): string {
  // Calculate total copies
  const totalCopies = items.reduce((sum, item) => {
    return sum + getCopyCount(instanceData, item.id);
  }, 0);

  // Generate items HTML
  const itemsHtml = items.map((item) => {
    const copyCount = getCopyCount(instanceData, item.id);
    const returnedCount = getReturnedCopyCount(rental.returned_items, item.id);
    const stillOut = copyCount - returnedCount;
    const depositPerCopy = item.deposit || 0;
    const totalDeposit = depositPerCopy * copyCount;
    const hasCopies = copyCount > 1;
    const hasPartialReturn = returnedCount > 0;

    return `
      <tr>
        <td style="padding: 10px 12px; border-bottom: 1px solid #333; font-family: monospace; font-weight: 600;">
          #${String(item.iid).padStart(4, '0')}
        </td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #333;">
          <strong>${item.name}</strong>
          ${item.brand ? `<br><span style="font-size: 0.9em;">Marke: ${item.brand}</span>` : ''}
          ${item.model ? `<br><span style="font-size: 0.9em;">Modell: ${item.model}</span>` : ''}
        </td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #333; text-align: center;">
          ${copyCount}${hasCopies ? ' Stück' : ''}
          ${hasPartialReturn ? `<br><span style="font-size: 0.85em; font-weight: 600; color: #16a34a;">${returnedCount} zurück, ${stillOut} noch aus</span>` : ''}
        </td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #333; text-align: right; font-weight: 600;">
          ${formatCurrency(totalDeposit)}
        </td>
      </tr>
    `;
  }).join('');

  return `
    <!DOCTYPE html>
    <html lang="de">
    <head>
      <meta charset="UTF-8">
      <title>Leihbeleg - LeihLokal</title>
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
          font-size: 12pt;
        }

        .header {
          text-align: center;
          border-bottom: 2px solid #000;
          padding-bottom: 15px;
          margin-bottom: 20px;
        }

        .header h1 {
          margin: 0 0 5px 0;
          font-size: 24pt;
          font-weight: bold;
        }

        .header .subtitle {
          font-size: 10pt;
        }

        .section {
          margin-bottom: 20px;
        }

        .section-title {
          font-size: 12pt;
          font-weight: 600;
          border-bottom: 1px solid #000;
          padding-bottom: 6px;
          margin-bottom: 12px;
        }

        .info-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }

        .info-item {
          border: 1px solid #333;
          padding: 10px;
        }

        .info-label {
          font-size: 9pt;
          margin-bottom: 3px;
        }

        .info-value {
          font-weight: 600;
          font-size: 11pt;
        }

        .customer-box {
          border: 2px solid #000;
          padding: 12px;
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
        }

        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 8px;
        }

        th {
          padding: 10px 12px;
          text-align: left;
          font-weight: 600;
          border-top: 2px solid #000;
          border-bottom: 2px solid #000;
        }

        th:last-child {
          text-align: right;
        }

        .total-row {
          font-weight: 600;
        }

        .total-row td {
          padding: 12px;
          border-top: 2px solid #000;
          border-bottom: 2px solid #000;
        }

        .footer {
          margin-top: 30px;
          padding-top: 15px;
          border-top: 1px solid #000;
          text-align: center;
          font-size: 9pt;
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
        <h1>Leihbeleg</h1>
        <div class="subtitle">Nutzerkopie &bull; leih.lokal Karlsruhe</div>
      </div>

      <div class="section">
        <div class="section-title">Nutzer:in</div>
        <div class="customer-box">
          <div class="customer-id">#${String(customer.iid).padStart(4, '0')}</div>
          <div class="customer-name">${customer.firstname} ${customer.lastname}</div>
          <div class="customer-details">
            ${customer.email ? `${customer.email}<br>` : ''}
            ${customer.phone ? `Tel: ${customer.phone}<br>` : ''}
            ${customer.street ? `${customer.street}, ${customer.postal_code} ${customer.city}` : ''}
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">Leihzeitraum</div>
        <div class="info-grid">
          <div class="info-item">
            <div class="info-label">Ausgeliehen am</div>
            <div class="info-value">${formatPrintDate(rental.rented_on)}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Zurückerwartet am</div>
            <div class="info-value">${formatPrintDate(rental.expected_on)}</div>
          </div>
          ${rental.extended_on ? `
            <div class="info-item">
              <div class="info-label">Verlängert am</div>
              <div class="info-value">${formatPrintDate(rental.extended_on)}</div>
            </div>
          ` : ''}
          ${rental.returned_on ? `
            <div class="info-item">
              <div class="info-label">Zurückgegeben am</div>
              <div class="info-value">${formatPrintDate(rental.returned_on)}</div>
            </div>
          ` : ''}
        </div>
      </div>

      <div class="section">
        <div class="section-title">Ausgeliehene Gegenstände (${totalCopies} ${totalCopies === 1 ? 'Stück' : 'Stück'})</div>
        <table>
          <thead>
            <tr>
              <th style="width: 80px;">Nr.</th>
              <th>Bezeichnung</th>
              <th style="width: 80px; text-align: center;">Anzahl</th>
              <th style="width: 100px; text-align: right;">Pfand</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
            <tr class="total-row">
              <td colspan="3" style="text-align: right;">Gesamt Pfand:</td>
              <td style="text-align: right; font-size: 14pt;">${formatCurrency(deposit)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      ${rental.remark ? `
        <div class="section">
          <div class="note-box">
            <div class="note-label">Bemerkung:</div>
            <div>${rental.remark}</div>
          </div>
        </div>
      ` : ''}

      ${rental.returned_items && Object.keys(rental.returned_items).length > 0 ? `
        <div class="section">
          <div class="note-box" style="background: #fff3cd; border-left: 4px solid #ffc107;">
            <div class="note-label">Hinweis:</div>
            <div>Teilrückgabe erfolgt - nicht alle Gegenstände zurückgegeben</div>
          </div>
        </div>
      ` : ''}

      <div class="section">
        <div class="section-title">Mitarbeiter</div>
        <div class="info-grid">
          <div class="info-item">
            <div class="info-label">Ausgabe</div>
            <div class="info-value">${rental.employee || '-'}</div>
          </div>
          ${rental.employee_back ? `
            <div class="info-item">
              <div class="info-label">Rücknahme</div>
              <div class="info-value">${rental.employee_back}</div>
            </div>
          ` : ''}
        </div>
      </div>

      <div class="footer">
        <p>Gedruckt am ${new Date().toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
        <p>Dies ist eine Nutzerquittung und dient nur zur Information.</p>
      </div>
    </body>
    </html>
  `;
}
