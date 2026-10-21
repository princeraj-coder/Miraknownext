// ─────────────────────────────────────────────────────────────────────────────
//  server/azure-storage.js — Azure Blob Storage & Document Extraction Service
// ─────────────────────────────────────────────────────────────────────────────
import { BlobServiceClient } from '@azure/storage-blob';
import crypto from 'crypto';
import path from 'path';

export class AzureStorageService {
  constructor() {
    this.connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING || '';
    this.containerName = process.env.AZURE_STORAGE_CONTAINER_NAME || 'mira-student-files';
    this.blobServiceClient = null;
    this.containerClient = null;

    if (this.connectionString) {
      try {
        this.blobServiceClient = BlobServiceClient.fromConnectionString(this.connectionString);
        this.containerClient = this.blobServiceClient.getContainerClient(this.containerName);
      } catch (err) {
        console.warn('[Azure Storage] Failed to initialize client from connection string:', err.message);
      }
    }
  }

  isConfigured() {
    return Boolean(this.blobServiceClient && this.containerClient);
  }

  async testConnection() {
    if (!this.isConfigured()) {
      return {
        success: false,
        message: 'AZURE_STORAGE_CONNECTION_STRING is not set in server environment.'
      };
    }
    try {
      const exists = await this.containerClient.exists();
      if (!exists) {
        await this.containerClient.create({ access: undefined }); // Private access
      }
      return { success: true, message: `Azure Blob container '${this.containerName}' verified (private access).` };
    } catch (err) {
      return { success: false, message: `Azure Storage error: ${err.message}` };
    }
  }

  /**
   * Sanitize filename to prevent directory traversal
   */
  sanitizeFilename(name) {
    return name
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/\.{2,}/g, '_')
      .slice(0, 100);
  }

  /**
   * Upload a student file to private user-scoped storage
   */
  async uploadFile({ userId, conversationId, filename, mimeType, buffer }) {
    if (!userId) throw new Error('User ID is required for storage authorization.');

    const safeName = this.sanitizeFilename(filename);
    const fileId = crypto.randomUUID();
    const blobPath = `users/${userId}/${conversationId || 'general'}/${fileId}_${safeName}`;

    let storageProvider = 'local_buffered';
    let storageUrl = '';

    if (this.isConfigured()) {
      try {
        // Ensure container exists
        const exists = await this.containerClient.exists();
        if (!exists) {
          await this.containerClient.create({ access: undefined });
        }

        const blockBlobClient = this.containerClient.getBlockBlobClient(blobPath);
        await blockBlobClient.uploadData(buffer, {
          blobHTTPHeaders: {
            blobContentType: mimeType,
            blobContentDisposition: `attachment; filename="${safeName}"`
          },
          metadata: {
            userId,
            conversationId: conversationId || '',
            originalName: encodeURIComponent(filename)
          }
        });

        storageProvider = 'azure';
        storageUrl = blockBlobClient.url;
      } catch (err) {
        console.warn('[Azure Storage] Upload failed, falling back to private memory buffer:', err.message);
      }
    }

    // Extract text content for AI consumption
    const extractedText = await this.extractContent(buffer, mimeType, filename);

    return {
      fileId,
      filename: safeName,
      originalName: filename,
      fileSize: buffer.length,
      mimeType,
      storagePath: blobPath,
      storageProvider,
      storageUrl,
      extractedText
    };
  }

  /**
   * Extract text / content from supported file formats
   */
  async extractContent(buffer, mimeType, filename) {
    const ext = path.extname(filename).toLowerCase();

    // 1. Plain text, markdown, CSV, JSON, code files
    const textExtensions = [
      '.txt', '.md', '.markdown', '.csv', '.json', '.js', '.jsx',
      '.ts', '.tsx', '.py', '.html', '.css', '.c', '.cpp', '.h',
      '.java', '.rs', '.go', '.sql', '.yaml', '.yml', '.xml'
    ];

    if (mimeType.startsWith('text/') || mimeType === 'application/json' || textExtensions.includes(ext)) {
      const text = buffer.toString('utf-8');
      // Truncate if exceeds 100,000 characters to prevent prompt blowup
      if (text.length > 100000) {
        return text.slice(0, 100000) + '\n\n...[Content truncated for model context limit]';
      }
      return text;
    }

    // 2. Images (PNG, JPG, WEBP, GIF)
    if (mimeType.startsWith('image/')) {
      // Images will be passed via dataUrl inline for vision models
      return null;
    }

    // 3. PDF extraction
    if (mimeType === 'application/pdf' || ext === '.pdf') {
      try {
        // Simple regex text stream extraction from uncompressed PDF streams
        const pdfRaw = buffer.toString('binary');
        const textParts = [];
        const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
        let match;
        while ((match = streamRegex.exec(pdfRaw)) !== null && textParts.length < 500) {
          const str = match[1];
          // Look for text in parens inside text objects (Tj / TJ)
          const tjMatches = str.match(/\(([^)]+)\)\s*Tj/g);
          if (tjMatches) {
            for (const tj of tjMatches) {
              const text = tj.replace(/^\(|\)\s*Tj$/g, '');
              if (text.trim()) textParts.push(text);
            }
          }
        }

        if (textParts.length > 0) {
          const extracted = textParts.join(' ').replace(/\s+/g, ' ').trim();
          return extracted.slice(0, 50000);
        }
      } catch (err) {
        console.warn('[PDF Extraction Error]', err.message);
      }
      return '[Attached PDF document. Content ready for multimodal analysis.]';
    }

    return null;
  }
}

export const azureStorage = new AzureStorageService();
