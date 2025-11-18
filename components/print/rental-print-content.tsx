/**
 * Rental Print Content Component
 * Generates the HTML content for printing a rental receipt
 */

import { formatCurrency } from '@/lib/utils/formatting';
import { localStringToDate } from '@/lib/utils/formatting';
import { getCopyCount, type InstanceData } from '@/lib/utils/instance-data';
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
    const depositPerCopy = item.deposit || 0;
    const totalDeposit = depositPerCopy * copyCount;
    const hasCopies = copyCount > 1;

    return `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #e5e5e5; font-family: monospace; font-weight: 600; color: #dc2626;">
          #${String(item.iid).padStart(4, '0')}
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e5e5;">
          <strong>${item.name}</strong>
          ${item.brand ? `<br><span style="color: #666; font-size: 0.9em;">Marke: ${item.brand}</span>` : ''}
          ${item.model ? `<br><span style="color: #666; font-size: 0.9em;">Modell: ${item.model}</span>` : ''}
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e5e5; text-align: center;">
          ${copyCount}${hasCopies ? ' Stück' : ''}
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e5e5; text-align: right; font-weight: 600;">
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
          margin: 15mm;
        }

        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 800px;
          margin: 0 auto;
          padding: 40px;
        }

        .header {
          text-align: center;
          border-bottom: 3px solid #dc2626;
          padding-bottom: 20px;
          margin-bottom: 30px;
        }

        .header h1 {
          margin: 0 0 5px 0;
          color: #dc2626;
          font-size: 28px;
        }

        .header .subtitle {
          color: #666;
          font-size: 14px;
        }

        .section {
          margin-bottom: 25px;
        }

        .section-title {
          font-size: 16px;
          font-weight: 600;
          color: #dc2626;
          border-bottom: 2px solid #e5e5e5;
          padding-bottom: 8px;
          margin-bottom: 15px;
        }

        .info-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 15px;
        }

        .info-item {
          background: #f8f9fa;
          padding: 12px;
          border-radius: 6px;
        }

        .info-label {
          font-size: 12px;
          color: #666;
          margin-bottom: 4px;
        }

        .info-value {
          font-weight: 600;
          font-size: 14px;
        }

        .customer-box {
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 8px;
          padding: 15px;
        }

        .customer-id {
          font-family: monospace;
          font-weight: 600;
          color: #dc2626;
          font-size: 16px;
        }

        .customer-name {
          font-size: 18px;
          font-weight: 600;
          margin: 5px 0;
        }

        .customer-details {
          color: #666;
          font-size: 13px;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 10px;
        }

        th {
          background: #f8f9fa;
          padding: 12px;
          text-align: left;
          font-weight: 600;
          border-bottom: 2px solid #e5e5e5;
        }

        th:last-child {
          text-align: right;
        }

        .total-row {
          background: #fef2f2;
          font-weight: 600;
        }

        .total-row td {
          padding: 15px 12px;
          border-top: 2px solid #dc2626;
        }

        .footer {
          margin-top: 40px;
          padding-top: 20px;
          border-top: 1px solid #e5e5e5;
          text-align: center;
          color: #999;
          font-size: 12px;
        }

        .note-box {
          background: #fffbeb;
          border: 1px solid #fde68a;
          border-radius: 6px;
          padding: 12px;
          margin-top: 10px;
        }

        .note-label {
          font-weight: 600;
          color: #92400e;
          margin-bottom: 5px;
        }

        @media print {
          body {
            padding: 0;
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
        <div class="subtitle">Kundenexemplar • LeihLokal</div>
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
              <td style="text-align: right; font-size: 16px;">${formatCurrency(deposit)}</td>
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
        <p>Dies ist eine Kundenquittung und dient nur zur Information.</p>
      </div>
    </body>
    </html>
  `;
}
