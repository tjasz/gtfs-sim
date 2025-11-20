import fs from 'fs';
import path from 'path';
import { BlobServiceClient } from '@azure/storage-blob';
import { Readable } from 'stream';

/**
 * Abstract storage provider interface
 */
class StorageProvider {
  /**
   * Check if a file exists
   * @param {string} filePath - Path to the file
   * @returns {Promise<boolean>}
   */
  async exists(filePath) {
    throw new Error('Not implemented');
  }

  /**
   * Create a read stream for a file
   * @param {string} filePath - Path to the file
   * @returns {Promise<ReadableStream>}
   */
  async createReadStream(filePath) {
    throw new Error('Not implemented');
  }
}

/**
 * Local file system storage provider
 */
class LocalStorageProvider extends StorageProvider {
  constructor(baseDir) {
    super();
    this.baseDir = baseDir;
  }

  async exists(filePath) {
    const fullPath = path.join(this.baseDir, filePath);
    return fs.existsSync(fullPath);
  }

  async createReadStream(filePath) {
    const fullPath = path.join(this.baseDir, filePath);
    return fs.createReadStream(fullPath);
  }
}

/**
 * Azure Blob Storage provider
 */
class AzureBlobStorageProvider extends StorageProvider {
  constructor(accountName, containerName, connectionString = null) {
    super();
    this.accountName = accountName;
    this.containerName = containerName;
    
    // Use connection string if provided, otherwise use DefaultAzureCredential (for managed identity)
    if (connectionString) {
      this.blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    } else {
      // Use anonymous access or public container
      const accountUrl = `https://${accountName}.blob.core.windows.net`;
      this.blobServiceClient = new BlobServiceClient(accountUrl);
    }
    
    this.containerClient = this.blobServiceClient.getContainerClient(containerName);
  }

  async exists(filePath) {
    try {
      const blobClient = this.containerClient.getBlobClient(filePath);
      return await blobClient.exists();
    } catch (error) {
      console.error(`Error checking blob existence: ${filePath}`, error);
      return false;
    }
  }

  async createReadStream(filePath) {
    try {
      const blobClient = this.containerClient.getBlobClient(filePath);
      const downloadResponse = await blobClient.download();
      
      // Azure SDK returns a Node.js ReadableStream
      return downloadResponse.readableStreamBody;
    } catch (error) {
      console.error(`Error downloading blob: ${filePath}`, error);
      throw error;
    }
  }
}

/**
 * Factory function to create the appropriate storage provider
 * @param {Object} config - Configuration object
 * @param {string} config.type - 'local' or 'azure'
 * @param {string} config.baseDir - Base directory for local storage
 * @param {string} config.accountName - Azure storage account name
 * @param {string} config.containerName - Azure container name
 * @param {string} config.connectionString - Optional Azure connection string
 * @returns {StorageProvider}
 */
export function createStorageProvider(config) {
  if (config.type === 'azure') {
    return new AzureBlobStorageProvider(
      config.accountName,
      config.containerName,
      config.connectionString
    );
  } else {
    return new LocalStorageProvider(config.baseDir);
  }
}

export { StorageProvider, LocalStorageProvider, AzureBlobStorageProvider };
