/**
 * Compact label design - Horizontal split with multiple QR codes
 * 100mm x 50mm label with side-by-side ID display
 */

'use client';

import { QRCodeSVG } from 'qrcode.react';
import { type Item } from '@/types';

interface CompactLabelProps {
  item: Item;
}

export function CompactLabel({ item }: CompactLabelProps) {
  // Format the item ID with leading zeros (e.g., "9901")
  const paddedId = String(item.iid).padStart(4, '0');

  // Split ID into two parts for display (e.g., "99" and "01")
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
        flexDirection: 'column',
        fontFamily: "'Univers LT Std', sans-serif",
        color: 'black',
        border: '2mm black solid',
      }}>
        
        {/* Item Name - Below QR */}
        <div style={{
          position: 'absolute',
          left: '3mm',
          top: '3mm',
          fontFamily: "'Univers LT Std', sans-serif",
          fontSize: '10pt',
          fontWeight: 400,
          lineHeight: '1.1',
          wordWrap: 'break-word',
          hyphens: 'auto',
          overflow: 'hidden',
          maxHeight: '20mm',
        }}>
          leih.lokal Karlsruhe - Gerwigstr. 41 - D-76131 Karlsruhe
        </div>

        {/* Item Name - Below QR */}
        <div style={{
          position: 'absolute',
          left: '3mm',
          top: '6.5mm',
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

        {/* ID Display Container */}
        <div style={{
          position: 'absolute',
          left: '2mm',
          top: '11mm',
          right: '2mm',
          height: '23mm',
          display: 'flex',
          flexDirection: 'row',
          borderTop: '1mm solid black',
        }}>
          {/* ID First Part - Left side (black background) */}
          <div style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'black',
            color: 'white',
          }}>
            <span style={{
              fontFamily: "'Univers LT Std', sans-serif",
              fontSize: '64pt',
              fontWeight: 900,
              lineHeight: '1',
              paddingTop: '5mm',
            }}>
              {idFirstPart}
            </span>
          </div>

          {/* ID Second Part - Right side (white background) */}
          <div style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'white',
            color: 'black',
          }}>
            <span style={{
              fontFamily: "'Univers LT Std', sans-serif",
              fontSize: '64pt',
              fontWeight: 900,
              lineHeight: '1',
              paddingTop: '5mm',
            }}>
              {idSecondPart}
            </span>
          </div>
        </div>

        {/* Bottom QR codes row */}
        <div style={{
          position: 'absolute',
          left: '2mm',
          bottom: '2mm',
          right: '2mm',
          height: '15mm',
          display: 'flex',
          flexDirection: 'row',
          gap: '1.5mm',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderTop: '1mm solid black',
          backgroundColor: 'white',
          padding: '1.5mm',
        }}>
          {Array(7).fill(null).map((_, i) => (
            <div key={i} style={{ flex: 1, height: '100%' }}>
              <QRCodeSVG
                value={paddedId}
                size={100}
                level="M"
                includeMargin={false}
                style={{
                  width: '100%',
                  height: '100%',
                }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}