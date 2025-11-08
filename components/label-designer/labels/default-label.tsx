/**
 * Default label design
 * 100mm x 50mm label with large QR code
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
        width: '100mm',
        height: '50mm',
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
        flexDirection: 'row',
        fontFamily: "'Univers LT Std', sans-serif",
        color: 'black',
      }}>
        {/* Left Section - QR Code */}
        <div style={{
          position: 'absolute',
          left: '4mm',
          top: '4mm',
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

        {/* Item Name - Below QR */}
        <div style={{
          position: 'absolute',
          left: '4mm',
          bottom: '4mm',
          width: '20mm',
          fontFamily: "'Univers LT Std', sans-serif",
          fontSize: '6pt',
          fontWeight: 400,
          lineHeight: '1.1',
          wordWrap: 'break-word',
          overflow: 'hidden',
          maxHeight: '18mm',
        }}>
          {item.name}
        </div>

        {/* Horizontal Address Text - Center */}
        <div style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
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
          right: '26mm',
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
          right: '26mm',
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

        {/* Logo - Far Right */}
        <div style={{
          position: 'absolute',
          right: '4mm',
          top: '50%',
          transform: 'translateY(-50%)',
          width: '18mm',
          height: '18mm',
        }}>
          <Image
            src="/smile.svg"
            alt="LeihLokal"
            fill
            style={{ objectFit: 'contain' }}
            unoptimized
          />
        </div>
      </div>
    </div>
  );
}
