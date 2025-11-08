/**
 * Default label design
 * 50mm x 100mm label with large QR code
 */

'use client';

import { QRCodeSVG } from 'qrcode.react';
import Image from 'next/image';
import { type Item } from '@/types';

interface DefaultLabelProps {
  item: Item;
}

export function DefaultLabel({ item }: DefaultLabelProps) {
  // Format the item ID with leading zeros (e.g., "0451")
  const paddedId = String(item.iid).padStart(4, '0');

  // Split ID into two parts for display (e.g., "04" and "51")
  const idFirstPart = paddedId.slice(0, 2);
  const idSecondPart = paddedId.slice(2);

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
      {/* Main content container */}
      <div style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: "'Univers LT Std', sans-serif",
        color: 'black',
      }}>
        {/* QR Code Section - Left Side */}
        <div style={{
          position: 'absolute',
          left: '4mm',
          top: '4mm',
          width: '18mm',
          height: '18mm',
        }}>
          <QRCodeSVG
            value={paddedId}
            size={68} // ~18mm at 96 DPI
            level="M"
            includeMargin={false}
            style={{
              width: '100%',
              height: '100%',
            }}
          />
        </div>

        {/* Item Name - Bottom Left */}
        <div style={{
          position: 'absolute',
          left: '4mm',
          bottom: '4mm',
          width: '18mm',
          fontFamily: "'Univers LT Std', sans-serif",
          fontSize: '6pt',
          fontWeight: 400,
          lineHeight: '1.1',
          wordWrap: 'break-word',
          overflow: 'hidden',
          maxHeight: '12mm',
        }}>
          {item.name}
        </div>

        {/* Vertical Address Text - Center */}
        <div style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%) rotate(-90deg)',
          transformOrigin: 'center center',
          whiteSpace: 'nowrap',
          fontFamily: "'Univers LT Std Condensed', sans-serif",
          fontSize: '7pt',
          fontWeight: 700,
          letterSpacing: '0.5px',
          textAlign: 'center',
        }}>
          Leih.Lokal GERWIGSTR. 41 KARLSRUHE
        </div>

        {/* ID First Part - Top Right */}
        <div style={{
          position: 'absolute',
          right: '4mm',
          top: '4mm',
          width: '20mm',
          height: '18mm',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '2px solid black',
          backgroundColor: 'black',
          color: 'white',
        }}>
          <span style={{
            fontFamily: "'Univers LT Std', sans-serif",
            fontSize: '48pt',
            fontWeight: 900,
            lineHeight: '1',
          }}>
            {idFirstPart}
          </span>
        </div>

        {/* ID Second Part - Bottom Right */}
        <div style={{
          position: 'absolute',
          right: '4mm',
          bottom: '4mm',
          width: '20mm',
          height: '18mm',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '2px solid black',
          backgroundColor: 'white',
          color: 'black',
        }}>
          <span style={{
            fontFamily: "'Univers LT Std', sans-serif",
            fontSize: '48pt',
            fontWeight: 900,
            lineHeight: '1',
          }}>
            {idSecondPart}
          </span>
        </div>
      </div>
    </div>
  );
}
