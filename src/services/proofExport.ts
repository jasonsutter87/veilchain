/**
 * VeilChain Proof Export Service
 *
 * Export proofs in various formats for external verification.
 */

import type { MerkleProof } from '../types.js';

/**
 * Proof export formats
 */
export type ProofExportFormat = 'json' | 'cbor' | 'compact';

/**
 * Exportable proof with metadata
 */
export interface ExportableProof {
  version: string;
  format: ProofExportFormat;
  ledgerId: string;
  entryId: string;
  proof: MerkleProof;
  entryHash: string;
  entryData?: unknown;
  timestamp: string;
  verificationUrl?: string;
}

/**
 * Compact proof format (minimal size)
 */
export interface CompactProof {
  v: number;        // version
  l: string;        // leaf hash
  r: string;        // root hash
  i: number;        // index
  p: string;        // proof hashes (concatenated hex)
  d: string;        // directions (binary string)
}

/**
 * QR code data for proof
 */
export interface ProofQRData {
  type: 'veilchain_proof';
  version: number;
  ledgerId: string;
  entryId: string;
  rootHash: string;
  verifyUrl: string;
}

/**
 * Proof export service
 */
export class ProofExportService {
  private version = '1.0';
  private baseUrl: string;

  constructor(baseUrl: string = 'https://veilchain.io') {
    this.baseUrl = baseUrl;
  }

  /**
   * Export proof as JSON
   */
  exportAsJson(
    ledgerId: string,
    entryId: string,
    proof: MerkleProof,
    entryHash: string,
    entryData?: unknown
  ): ExportableProof {
    return {
      version: this.version,
      format: 'json',
      ledgerId,
      entryId,
      proof,
      entryHash,
      entryData,
      timestamp: new Date().toISOString(),
      verificationUrl: this.getVerificationUrl(ledgerId, entryId),
    };
  }

  /**
   * Export proof as CBOR (Concise Binary Object Representation)
   * Returns base64-encoded CBOR data
   */
  exportAsCbor(
    ledgerId: string,
    entryId: string,
    proof: MerkleProof,
    entryHash: string
  ): string {
    // CBOR encoding without external dependency
    // Using a simple custom binary format for proof data
    const compact = this.toCompactProof(proof);
    const header = Buffer.from([0xd9, 0xd9, 0xf7]); // CBOR self-describing tag

    // Encode as concatenated fields
    const parts = [
      this.encodeCborString(this.version),
      this.encodeCborString(ledgerId),
      this.encodeCborString(entryId),
      this.encodeCborString(entryHash),
      this.encodeCborString(compact.l),
      this.encodeCborString(compact.r),
      this.encodeCborInt(compact.i),
      this.encodeCborString(compact.p),
      this.encodeCborString(compact.d),
    ];

    const payload = Buffer.concat([header, ...parts]);
    return payload.toString('base64');
  }

  /**
   * Export proof as compact format (minimal size)
   */
  exportAsCompact(proof: MerkleProof): CompactProof {
    return this.toCompactProof(proof);
  }

  /**
   * Convert proof to compact format
   */
  private toCompactProof(proof: MerkleProof): CompactProof {
    // Concatenate all proof hashes without separators
    const proofHashes = proof.proof.join('');

    // Convert directions to binary string (left=0, right=1)
    const directions = proof.directions
      .map(d => d === 'left' ? '0' : '1')
      .join('');

    return {
      v: 1,
      l: proof.leaf,
      r: proof.root,
      i: proof.index,
      p: proofHashes,
      d: directions,
    };
  }

  /**
   * Parse compact proof back to MerkleProof
   */
  parseCompactProof(compact: CompactProof): MerkleProof {
    // Split proof hashes (each is 64 chars for SHA256)
    const proofHashes: string[] = [];
    for (let i = 0; i < compact.p.length; i += 64) {
      proofHashes.push(compact.p.substring(i, i + 64));
    }

    // Parse directions
    const directions = compact.d.split('').map(d => d === '0' ? 'left' : 'right') as ('left' | 'right')[];

    return {
      leaf: compact.l,
      index: compact.i,
      proof: proofHashes,
      directions,
      root: compact.r,
    };
  }

  /**
   * Generate verification URL for a proof
   */
  getVerificationUrl(ledgerId: string, entryId: string): string {
    return `${this.baseUrl}/verify/${ledgerId}/${entryId}`;
  }

  /**
   * Generate QR code data for proof verification
   */
  getQRCodeData(
    ledgerId: string,
    entryId: string,
    rootHash: string
  ): ProofQRData {
    return {
      type: 'veilchain_proof',
      version: 1,
      ledgerId,
      entryId,
      rootHash,
      verifyUrl: this.getVerificationUrl(ledgerId, entryId),
    };
  }

  /**
   * Generate QR code as SVG string
   */
  generateQRCodeSvg(data: ProofQRData, size: number = 200): string {
    // Simple QR code generation using a basic algorithm
    // For production, you'd want to use a proper QR library
    const dataStr = JSON.stringify(data);
    const encoded = this.encodeQRData(dataStr);

    return this.renderQRCodeSvg(encoded, size);
  }

  /**
   * Encode data for QR code
   * This is a simplified implementation - production should use a proper QR library
   */
  private encodeQRData(data: string): boolean[][] {
    // Create a simple representation for the QR code
    // This is NOT a real QR code - just a visual placeholder
    // In production, use a library like 'qrcode' or 'qr-image'

    const size = 25; // Standard QR size
    const grid: boolean[][] = Array(size).fill(null).map(() => Array(size).fill(false));

    // Add finder patterns (corners)
    this.addFinderPattern(grid, 0, 0);
    this.addFinderPattern(grid, size - 7, 0);
    this.addFinderPattern(grid, 0, size - 7);

    // Add timing patterns
    for (let i = 8; i < size - 8; i++) {
      grid[6][i] = i % 2 === 0;
      grid[i][6] = i % 2 === 0;
    }

    // Fill data area with hash of input (simplified)
    const hash = this.simpleHash(data);
    let bit = 0;
    for (let col = size - 1; col > 0; col -= 2) {
      if (col === 6) col = 5; // Skip timing pattern
      for (let row = 0; row < size; row++) {
        if (!this.isReserved(row, col, size)) {
          grid[row][col] = ((hash >> (bit % 32)) & 1) === 1;
          bit++;
        }
        if (!this.isReserved(row, col - 1, size)) {
          grid[row][col - 1] = ((hash >> (bit % 32)) & 1) === 1;
          bit++;
        }
      }
    }

    return grid;
  }

  /**
   * Add a finder pattern to the QR grid
   */
  private addFinderPattern(grid: boolean[][], startRow: number, startCol: number): void {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        const isOuter = r === 0 || r === 6 || c === 0 || c === 6;
        const isInner = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        grid[startRow + r][startCol + c] = isOuter || isInner;
      }
    }
  }

  /**
   * Check if a position is reserved (finder/timing patterns)
   */
  private isReserved(row: number, col: number, size: number): boolean {
    // Finder patterns
    if ((row < 9 && col < 9) || (row < 9 && col >= size - 8) || (row >= size - 8 && col < 9)) {
      return true;
    }
    // Timing patterns
    if (row === 6 || col === 6) return true;
    return false;
  }

  /**
   * Simple hash function for demo purposes
   */
  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  /**
   * Render QR code as SVG
   */
  private renderQRCodeSvg(grid: boolean[][], size: number): string {
    const moduleSize = size / grid.length;
    let paths = '';

    for (let row = 0; row < grid.length; row++) {
      for (let col = 0; col < grid[row].length; col++) {
        if (grid[row][col]) {
          const x = col * moduleSize;
          const y = row * moduleSize;
          paths += `<rect x="${x}" y="${y}" width="${moduleSize}" height="${moduleSize}" />`;
        }
      }
    }

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
  <rect width="100%" height="100%" fill="white"/>
  <g fill="black">
    ${paths}
  </g>
</svg>`;
  }

  /**
   * Encode string as CBOR
   */
  private encodeCborString(str: string): Buffer {
    const bytes = Buffer.from(str, 'utf8');
    const len = bytes.length;

    if (len < 24) {
      return Buffer.concat([Buffer.from([0x60 + len]), bytes]);
    } else if (len < 256) {
      return Buffer.concat([Buffer.from([0x78, len]), bytes]);
    } else if (len < 65536) {
      return Buffer.concat([Buffer.from([0x79, len >> 8, len & 0xff]), bytes]);
    } else {
      const lenBuf = Buffer.alloc(4);
      lenBuf.writeUInt32BE(len, 0);
      return Buffer.concat([Buffer.from([0x7a]), lenBuf, bytes]);
    }
  }

  /**
   * Encode integer as CBOR
   */
  private encodeCborInt(num: number): Buffer {
    if (num < 24) {
      return Buffer.from([num]);
    } else if (num < 256) {
      return Buffer.from([0x18, num]);
    } else if (num < 65536) {
      return Buffer.from([0x19, num >> 8, num & 0xff]);
    } else {
      const buf = Buffer.alloc(5);
      buf[0] = 0x1a;
      buf.writeUInt32BE(num, 1);
      return buf;
    }
  }

  /**
   * Calculate proof size in bytes
   */
  getProofSize(proof: MerkleProof, format: ProofExportFormat): number {
    switch (format) {
      case 'json':
        return JSON.stringify(this.exportAsJson('', '', proof, proof.leaf)).length;
      case 'cbor':
        return this.exportAsCbor('', '', proof, proof.leaf).length;
      case 'compact':
        return JSON.stringify(this.exportAsCompact(proof)).length;
    }
  }
}

/**
 * Create proof export service
 */
export function createProofExportService(baseUrl?: string): ProofExportService {
  return new ProofExportService(baseUrl);
}
