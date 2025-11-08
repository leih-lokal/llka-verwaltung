/**
 * Cable wrap label design - Flag style
 * 100mm x 50mm label designed to wrap around cables
 * Left and right sides form visible "flags" when wrapped
 */

'use client';

import { QRCodeSVG } from 'qrcode.react';
import { type Item } from '@/types';

interface CordLabelProps {
  item: Item;
}

export function CordLabel({ item }: CordLabelProps) {
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
        flexDirection: 'row',
        fontFamily: "'Univers LT Std', sans-serif",
        color: 'black',
      }}>
        
        {/* LEFT FLAG SIDE */}
        <div style={{
          position: 'absolute',
          left: '0',
          top: '0',
          width: '45mm',
          height: '50mm',
          border: '2mm solid black',
          backgroundColor: 'white',
          display: 'flex',
          flexDirection: 'column',
        }}>
          {/* QR Code */}
          <div style={{
            position: 'absolute',
            left: '2mm',
            top: '2mm',
            width: '37mm',
            height: '37mm',
          }}>
            <QRCodeSVG
              value={paddedId}
              size={100}
              level="M"
              includeMargin={false}
              fgColor="black"
              bgColor="white"
              style={{
                width: '100%',
                height: '100%',
              }}
            />
          </div>
          
          {/* ID */}
          <div style={{
            position: 'absolute',
            bottom: '2mm',
            width: '41mm',
            height: '5mm',
            display: 'flex',
            alignItems: 'center',
            textAlign: 'center',
            justifyContent: 'center',
            fontSize: '7pt',
            fontFamily: "'Univers LT Std', sans-serif",
            fontWeight: 400,
            lineHeight: '1',
            paddingTop: '3mm',
          }}>
            leih.lokal Karlsruhe <br />Gerwigstr. 41
          </div>

        </div>

        {/* CENTER SPINE - Cable wrap area */}
        <div style={{
          position: 'absolute',
          left: '45mm',
          top: '0',
          width: '10mm',
          height: '50mm',
          backgroundColor: 'black',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
        }}>
          

        </div>

          <div style={{
            position: 'absolute',
            left: '49mm',
            top: '0',
            width: '2mm',
            height: '50mm',
            backgroundColor: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
          }} />
          
          
        {/* RIGHT FLAG SIDE */}
        <div style={{
          position: 'absolute',
          right: '0',
          top: '0',
          width: '45mm',
          height: '50mm',
          border: '2mm solid black',
          backgroundColor: 'white',
          display: 'flex',
          flexDirection: 'column',
        }}>
          {/* ID First Part */}
          <div style={{
            position: 'absolute',
            left: '0mm',
            top: '0mm',
            right: '0mm',
            height: '16mm',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'black',
            color: 'white',
            border: '2px solid black',
          }}>
            <span style={{
              fontFamily: "'Univers LT Std', sans-serif",
              fontSize: '50pt',
              fontWeight: 900,
              lineHeight: '1',
              paddingTop: '3mm',
            }}>
              {idFirstPart}
            </span>
          </div>
          {/* ID Second Part */}
          <div style={{
            position: 'absolute',
            left: '0mm',
            top: '17mm',
            right: '0mm',
            height: '16mm',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'white',
            color: 'black',
            borderBottom: '2px solid black',
          }}>
            <span style={{
              fontFamily: "'Univers LT Std', sans-serif",
              fontSize: '50pt',
              fontWeight: 900,
              lineHeight: '1',
              paddingTop: '3mm',
            }}>
              {idSecondPart}
            </span>
          </div>

          {/* Item Name */}
          <div style={{
            position: 'absolute',
            left: '2mm',
            right: '2mm',
            bottom: '1mm',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',

          }}>
            <span style={{
              fontFamily: "'Univers LT Std', sans-serif",
              fontSize: '10pt',
              hyphens: 'auto',
              fontWeight: 700,
              lineHeight: '1.2',
              textAlign: 'center',
              wordWrap: 'break-word',
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: 4,
              WebkitBoxOrient: 'vertical',
            }}>
              {item.name}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}