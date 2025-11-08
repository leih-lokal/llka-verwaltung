/**
 * Cord label design
 * 100mm x 50mm label optimized for wrapping around cables/cords
 * Vertical sections layout
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
        fontFamily: "'Univers LT Std', sans-serif",
        color: 'black',
      }}>
        {/* Left Section - ID and QR Code */}
        <div style={{
          width: '30mm',
          height: '100%',
          borderRight: '2px solid black',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2mm',
          gap: '2mm',
        }}>
          <div style={{
            fontFamily: "'Univers LT Std', sans-serif",
            fontSize: '32pt',
            fontWeight: 900,
            lineHeight: '1',
          }}>
            {paddedId}
          </div>
          <div style={{
            width: '22mm',
            height: '22mm',
          }}>
            <QRCodeSVG
              value={paddedId}
              size={83}
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
          borderRight: '2px solid black',
        }}>
          <div style={{
            fontFamily: "'Univers LT Std', sans-serif",
            fontSize: '16pt',
            fontWeight: 700,
            lineHeight: '1.2',
            textAlign: 'center',
          }}>
            {item.name}
          </div>
        </div>

        {/* Right Section - Address */}
        <div style={{
          width: '25mm',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2mm',
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
            <div style={{ fontSize: '7pt', fontWeight: 400, marginTop: '1mm' }}>
              Gerwigstr. 41
            </div>
            <div style={{ fontSize: '7pt', fontWeight: 400 }}>
              76131
            </div>
            <div style={{ fontSize: '7pt', fontWeight: 400 }}>
              Karlsruhe
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
