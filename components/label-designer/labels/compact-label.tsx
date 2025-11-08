/**
 * Compact label design
 * 100mm x 50mm label with smaller QR code for more text space
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
        width: '100mm',
        height: '50mm',
        backgroundColor: 'white',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'row',
        padding: '4mm',
        fontFamily: "'Univers LT Std', sans-serif",
        color: 'black',
        gap: '3mm',
      }}>
        {/* Left Section - Logo and QR */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '2mm',
          flexShrink: 0,
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
            width: '15mm',
            height: '15mm',
          }}>
            <QRCodeSVG
              value={paddedId}
              size={57}
              level="M"
              includeMargin={false}
              style={{
                width: '100%',
                height: '100%',
              }}
            />
          </div>
        </div>

        {/* Center Section - Item Name and Address */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}>
          <div style={{
            fontFamily: "'Univers LT Std', sans-serif",
            fontSize: '14pt',
            fontWeight: 700,
            lineHeight: '1.2',
          }}>
            {item.name}
          </div>
          <div style={{
            fontFamily: "'Univers LT Std Condensed', sans-serif",
            fontSize: '8pt',
            fontWeight: 400,
            lineHeight: '1.3',
          }}>
            <div style={{ fontWeight: 700 }}>Leih.Lokal</div>
            <div>Gerwigstr. 41, 76131 Karlsruhe</div>
          </div>
        </div>

        {/* Right Section - ID */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderLeft: '2px solid black',
          paddingLeft: '3mm',
        }}>
          <div style={{
            fontFamily: "'Univers LT Std', sans-serif",
            fontSize: '52pt',
            fontWeight: 900,
            lineHeight: '1',
          }}>
            {paddedId}
          </div>
        </div>
      </div>
    </div>
  );
}
