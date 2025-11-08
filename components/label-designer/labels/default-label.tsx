/**
 * Default label design
 * 100mm x 50mm label with large QR code
 */

'use client';

import { QRCodeSVG } from 'qrcode.react';
import { type Item } from '@/types';

interface DefaultLabelProps {
  item: Item;
}

export function DefaultLabel({ item }: DefaultLabelProps) {
  // Format the item ID with leading zeros (e.g., "1245")
  const paddedId = String(item.iid).padStart(4, '0');

  // Split ID into two parts for display (e.g., "12" and "45")
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
        border: '2mm black solid',
      }}>
        {/* Left Section - QR Code */}
        <div style={{
          position: 'absolute',
          left: '2mm',
          top: '2mm',
          width: '42mm',
          height: '35mm',
          padding: '2mm',
          border: '4px black solid', // Invert border color
          backgroundColor: 'black',
        }}>
          <QRCodeSVG
            value={paddedId}
            size={75}
            level="M"
            includeMargin={false}
            fgColor="white" // Invert foreground color
            bgColor="black" // Invert background color
            style={{
              width: '100%',
              height: '100%',
            }}
          />
        </div>

        {/* Item Name - Below QR */}
        <div style={{
          position: 'absolute',
          left: '3mm',
          bottom: '3mm',
          width: '42mm',
          fontFamily: "'Univers LT Std', sans-serif",
          fontSize: '11pt',
          fontWeight: 700,
          lineHeight: '1.1',
          wordWrap: 'break-word',
          hyphens: 'auto',
          overflow: 'hidden',
          maxHeight: '20mm',
        }}>
          {item.name}
        </div>

        {/* Vertical Address Text - Center (rotated 90 degrees counterclockwise) */}
        <div style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%) rotate(-90deg)',
          transformOrigin: 'center center',
          whiteSpace: 'nowrap',
          fontFamily: "'Univers LT Std', sans-serif",
          lineHeight: '1',
          fontSize: '7pt',
          fontWeight: 700,
          textAlign: 'center',
        }}>
          leih.lokal GERWIGSTR. 41 KARLSRUHE<br />
          leih.lokal GERWIGSTR. 41 KARLSRUHE<br />
          leih.lokal GERWIGSTR. 41 KARLSRUHE<br />
          leih.lokal GERWIGSTR. 41 KARLSRUHE<br />
          leih.lokal GERWIGSTR. 41 KARLSRUHE<br />
          leih.lokal GERWIGSTR. 41 KARLSRUHE
        </div>

        {/* ID First Part - Top Right */}
        <div style={{
          position: 'absolute',
          right: '2mm',
          top: '2mm',
          width: '43mm',
          height: '23mm',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'black',
          color: 'white',
        }}>
          <span style={{
            fontFamily: "'Univers LT Std', sans-serif",
            fontSize: '72pt',
            fontWeight: 900,
            lineHeight: '1',
            whiteSpace: 'nowrap',
            textAlign: 'center',
            paddingTop: '6mm',
          }}>
            {idFirstPart}
          </span>
        </div>

        {/* ID Second Part - Bottom Right */}
        <div style={{
          position: 'absolute',
          right: '2mm',
          bottom: '2mm',
          width: '43mm',
          height: '23mm',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '2px solid black',
          backgroundColor: 'white',
          color: 'black',
        }}>
          <span style={{
            fontFamily: "'Univers LT Std', sans-serif",
            fontSize: '72pt',
            fontWeight: 900,
            lineHeight: '1',
            paddingTop: '6mm',
          }}>
            {idSecondPart}
          </span>
        </div>
      </div>
    </div>
  );
}