import {
  createServices,
  HeadBucketCommand,
  CreateBucketCommand,
  PutBucketCorsCommand,
} from '../packages/backend/src/index.ts';

const services = createServices();
try {
  try {
    await services.s3.send(new HeadBucketCommand({ Bucket: services.bucket }));
  } catch (error) {
    if (error?.$metadata?.httpStatusCode !== 404) throw error;
    try {
      await services.s3.send(
        new CreateBucketCommand({ Bucket: services.bucket }),
      );
    } catch (creationError) {
      if (creationError?.name !== 'BucketAlreadyOwnedByYou')
        throw creationError;
    }
  }
  const origin = process.env.WEB_ORIGIN;
  if (!origin) throw new Error('Missing WEB_ORIGIN');
  await services.s3.send(
    new PutBucketCorsCommand({
      Bucket: services.bucket,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedOrigins: [origin],
            AllowedMethods: ['GET', 'PUT', 'HEAD'],
            AllowedHeaders: ['*'],
            ExposeHeaders: ['ETag'],
            MaxAgeSeconds: 3600,
          },
        ],
      },
    }),
  );
  console.log('Object storage bucket and CORS initialized.');
} catch {
  console.error(
    'Storage initialization failed; check endpoint, credentials and bucket permissions.',
  );
  process.exitCode = 1;
} finally {
  await services.close();
}
