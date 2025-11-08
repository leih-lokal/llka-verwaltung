/**
 * Compact label design
 * 50mm x 100mm label with smaller QR code for more text space
 */

'use client';

import { QRCodeSVG } from 'qrcode.react';
import Image from 'next/image';
import { type Item } from '@/types';

interface CompactLabelProps {
  item: Item;
}

export function CompactLabel({ item }: CompactLabelProps) {
  const paddedId = String(item.iid).padStart(4, '0');

  return (
    <div
      className="label-print-area"
      style={{
        width: '50mm',
        height: '100mm',
        backgroundColor: 'white',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        padding: '4mm',
        fontFamily: "'Univers LT Std', sans-serif",
        color: 'black',
        gap: '3mm',
      }}>
        {/* Header with Logo and ID */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '2px solid black',
          paddingBottom: '2mm',
        }}>
          <div style={{
            position: 'relative',
            width: '15mm',
            height: '15mm',
          }}>
            <Image
              src="/smile.svg"
              alt="LeihLokal"
              fill
              style={{ objectFit: 'contain' }}
              unoptimized
            />
          </div>
          <div style={{
            fontFamily: "'Univers LT Std', sans-serif",
            fontSize: '32pt',
            fontWeight: 900,
            lineHeight: '1',
          }}>
            {paddedId}
          </div>
        </div>

        {/* Item Name */}
        <div style={{
          fontFamily: "'Univers LT Std', sans-serif",
          fontSize: '12pt',
          fontWeight: 700,
          lineHeight: '1.2',
          flex: 1,
          display: 'flex',
          alignItems: 'center',
        }}>
          {item.name}
        </div>

        {/* QR Code and Address */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          gap: '2mm',
        }}>
          <div style={{
            width: '12mm',
            height: '12mm',
            flexShrink: 0,
          }}>
            <QRCodeSVG
              value={paddedId}
              size={45}
              level="M"
              includeMargin={false}
              style={{
                width: '100%',
                height: '100%',
              }}
            />
          </div>
          <div style={{
            fontFamily: "'Univers LT Std Condensed', sans-serif",
            fontSize: '6pt',
            fontWeight: 400,
            lineHeight: '1.2',
            textAlign: 'right',
          }}>
            <div style={{ fontWeight: 700 }}>Leih.Lokal</div>
            <div>Gerwigstr. 41</div>
            <div>76131 Karlsruhe</div>
          </div>
        </div>
      </div>
    </div>
  );
}
