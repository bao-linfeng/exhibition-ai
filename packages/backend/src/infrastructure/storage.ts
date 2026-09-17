import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'node:stream';

export interface StorageProvider {
  signUploadUrl(opts: {
    bucket: string;
    key: string;
    contentType: string;
    contentLength: number;
    expiresInSeconds: number;
  }): Promise<{ url: string; requiredHeaders: Record<string, string> }>;

  signDownloadUrl(opts: {
    bucket: string;
    key: string;
    expiresInSeconds: number;
  }): Promise<{ url: string }>;

  headObject(opts: {
    bucket: string;
    key: string;
  }): Promise<{ exists: boolean; contentLength?: number; etag?: string }>;

  getObject(opts: { bucket: string; key: string }): Promise<{
    body: Readable;
    contentLength?: number;
    contentType?: string;
  }>;

  putObject(opts: {
    bucket: string;
    key: string;
    body: Buffer | Readable;
    contentType: string;
    contentLength?: number;
  }): Promise<void>;

  deleteObject(opts: { bucket: string; key: string }): Promise<void>;
}

export class S3StorageProvider implements StorageProvider {
  constructor(
    private readonly internalClient: S3Client,
    private readonly publicEndpoint: string | undefined,
    private readonly region: string,
  ) {}

  async signUploadUrl(opts: {
    bucket: string;
    key: string;
    contentType: string;
    contentLength: number;
    expiresInSeconds: number;
  }): Promise<{ url: string; requiredHeaders: Record<string, string> }> {
    const command = new PutObjectCommand({
      Bucket: opts.bucket,
      Key: opts.key,
      ContentType: opts.contentType,
      ContentLength: opts.contentLength,
    });

    let url = await getSignedUrl(this.internalClient, command, {
      expiresIn: opts.expiresInSeconds,
    });

    if (this.publicEndpoint) {
      url = rewriteEndpoint(url, this.publicEndpoint);
    }

    return {
      url,
      requiredHeaders: {
        'Content-Type': opts.contentType,
        'Content-Length': String(opts.contentLength),
      },
    };
  }

  async signDownloadUrl(opts: {
    bucket: string;
    key: string;
    expiresInSeconds: number;
  }): Promise<{ url: string }> {
    const command = new GetObjectCommand({
      Bucket: opts.bucket,
      Key: opts.key,
    });

    let url = await getSignedUrl(this.internalClient, command, {
      expiresIn: opts.expiresInSeconds,
    });

    if (this.publicEndpoint) {
      url = rewriteEndpoint(url, this.publicEndpoint);
    }

    return { url };
  }

  async headObject(opts: {
    bucket: string;
    key: string;
  }): Promise<{ exists: boolean; contentLength?: number; etag?: string }> {
    try {
      const result = await this.internalClient.send(
        new HeadObjectCommand({ Bucket: opts.bucket, Key: opts.key }),
      );
      return {
        exists: true,
        contentLength: result.ContentLength,
        etag: result.ETag?.replace(/"/g, ''),
      };
    } catch (err: unknown) {
      const status = (err as { $metadata?: { httpStatusCode?: number } })
        ?.$metadata?.httpStatusCode;
      if (status === 404 || status === 403) {
        return { exists: false };
      }
      throw err;
    }
  }

  async getObject(opts: { bucket: string; key: string }): Promise<{
    body: Readable;
    contentLength?: number;
    contentType?: string;
  }> {
    const result = await this.internalClient.send(
      new GetObjectCommand({ Bucket: opts.bucket, Key: opts.key }),
    );
    if (!result.Body || !(result.Body instanceof Readable)) {
      throw new Error('Storage object body is not a readable stream');
    }

    return {
      body: result.Body,
      contentLength: result.ContentLength,
      contentType: result.ContentType,
    };
  }

  async putObject(opts: {
    bucket: string;
    key: string;
    body: Buffer | Readable;
    contentType: string;
    contentLength?: number;
  }): Promise<void> {
    await this.internalClient.send(
      new PutObjectCommand({
        Bucket: opts.bucket,
        Key: opts.key,
        Body: opts.body,
        ContentType: opts.contentType,
        ContentLength: opts.contentLength,
      }),
    );
  }

  async deleteObject(opts: { bucket: string; key: string }): Promise<void> {
    await this.internalClient.send(
      new DeleteObjectCommand({ Bucket: opts.bucket, Key: opts.key }),
    );
  }
}

function rewriteEndpoint(signedUrl: string, publicEndpoint: string): string {
  const url = new URL(signedUrl);
  const publicUrl = new URL(publicEndpoint);
  url.protocol = publicUrl.protocol;
  url.hostname = publicUrl.hostname;
  url.port = publicUrl.port;
  return url.toString();
}
