"use client";

import { useMemo } from "react";
import { generateQRCodeMatrix } from "@/lib/qrcode";

export function QRCode({ value, size = 160, className = "" }) {
  const matrix = useMemo(() => {
    if (!value) return [];
    try {
      return generateQRCodeMatrix(value);
    } catch (e) {
      console.error("Failed to generate QR code", e);
      return [];
    }
  }, [value]);

  if (!matrix || matrix.length === 0) {
    return <div style={{ width: size, height: size }} className="bg-gray-100 rounded-lg animate-pulse" />;
  }

  const moduleCount = matrix.length;
  const cellSize = size / moduleCount;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={`rounded-lg bg-white p-2 shadow-sm ${className}`}
      aria-label="QR Code"
    >
      {matrix.map((row, r) =>
        row.map((isDark, c) => {
          if (!isDark) return null;
          return (
            <rect
              key={`${r}-${c}`}
              x={c * cellSize}
              y={r * cellSize}
              width={cellSize + 0.5} // slight overlap to prevent subpixel hairline gaps
              height={cellSize + 0.5}
              fill="#0b4f5c" // brand teal
            />
          );
        })
      )}
    </svg>
  );
}

