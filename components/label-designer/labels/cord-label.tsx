/**
 * Cord label design
 * 50mm x 100mm label optimized for wrapping around cables/cords
 * Narrow horizontal layout
 */

'use client';

import { QRCodeSVG } from 'qrcode.react';
import { type Item } from '@/types';

interface CordLabelProps {
  item: Item;
}

export function CordLabel({ item }: CordLabelProps) {
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
        fontFamily: "'Univers LT Std', sans-serif",
        color: 'black',
      }}>
        {/* Top Section - ID and QR Code */}
        <div style={{
          height: '25mm',
          borderBottom: '2px solid black',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '2mm 4mm',
        }}>
          <div style={{
            fontFamily: "'Univers LT Std', sans-serif",
            fontSize: '42pt',
            fontWeight: 900,
            lineHeight: '1',
          }}>
            {paddedId}
          </div>
          <div style={{
            width: '20mm',
            height: '20mm',
          }}>
            <QRCodeSVG
              value={paddedId}
              size={75}
              level="M"
              includeMargin={false}
              style={{
                width: '100%',
                height: '100%',
              }}
            />
          </div>
        </div>

        {/* Middle Section - Item Name */}
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '4mm',
          borderBottom: '2px solid black',
        }}>
          <div style={{
            fontFamily: "'Univers LT Std', sans-serif",
            fontSize: '14pt',
            fontWeight: 700,
            lineHeight: '1.2',
            textAlign: 'center',
          }}>
            {item.name}
          </div>
        </div>

        {/* Bottom Section - Address */}
        <div style={{
          height: '20mm',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2mm 4mm',
          backgroundColor: 'black',
          color: 'white',
        }}>
          <div style={{
            fontFamily: "'Univers LT Std Condensed', sans-serif",
            fontSize: '9pt',
            fontWeight: 700,
            lineHeight: '1.3',
            textAlign: 'center',
          }}>
            <div>Leih.Lokal</div>
            <div>Gerwigstr. 41, 76131 Karlsruhe</div>
          </div>
        </div>
      </div>
    </div>
  );
}
