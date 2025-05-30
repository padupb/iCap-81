
import React, { useEffect, useRef } from 'react';
import QRCode from 'qrcode';

interface QRCodeComponentProps {
  value: string;
  size?: number;
  className?: string;
}

export function QRCodeComponent({ 
  value, 
  size = 128, 
  className = "" 
}: QRCodeComponentProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current && value) {
      QRCode.toCanvas(canvasRef.current, value, {
        width: size,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      }, (error) => {
        if (error) {
          console.error('Erro ao gerar QR code:', error);
        }
      });
    }
  }, [value, size]);

  return (
    <div className={`flex flex-col items-center space-y-2 ${className}`}>
      <canvas 
        ref={canvasRef}
        className="border rounded-lg bg-white p-2"
      />
      <p className="text-xs text-muted-foreground text-center">
        QR Code do Pedido
      </p>
    </div>
  );
}
