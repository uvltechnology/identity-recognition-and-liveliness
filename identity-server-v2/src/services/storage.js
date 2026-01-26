import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let s3Client = null;
let s3Bucket = process.env.AWS_S3_BUCKET || process.env.IDENTITY_S3_BUCKET || '';

export async function uploadImageToStorage(base64Data, sid) {
  const buffer = Buffer.from(base64Data, 'base64');
  const filename = `identity_${sid}_${Date.now()}.jpg`;
  
  if (s3Bucket) {
    try {
      const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
      if (!s3Client) {
        s3Client = new S3Client({ region: process.env.AWS_REGION || process.env.IDENTITY_S3_REGION || 'us-east-1' });
      }
      const key = `temp/${sid}/${filename}`;
      const cmd = new PutObjectCommand({ Bucket: s3Bucket, Key: key, Body: buffer, ContentType: 'image/jpeg' });
      await s3Client.send(cmd);
      return { type: 's3', key };
    } catch (e) {
      console.warn('[storage] S3 upload failed, falling back to local storage', e?.message || e);
    }
  }

  try {
    const publicDir = path.join(__dirname, '../../public');
    const uploadsDir = path.join(publicDir, 'temp_uploads');
    await fs.mkdir(uploadsDir, { recursive: true });
    const outPath = path.join(uploadsDir, filename);
    await fs.writeFile(outPath, buffer);
    return { type: 'local', url: `/temp_uploads/${filename}` };
  } catch (e) {
    console.warn('[storage] local image write failed', e?.message || e);
    return null;
  }
}

export async function deleteImageFromStorage(ref) {
  if (!ref) return;
  try {
    if (ref.type === 's3' && ref.key && s3Bucket) {
      const { S3Client, DeleteObjectCommand } = await import('@aws-sdk/client-s3');
      if (!s3Client) s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
      const cmd = new DeleteObjectCommand({ Bucket: s3Bucket, Key: ref.key });
      await s3Client.send(cmd);
    }
    if (ref.type === 'local' && ref.url) {
      const publicDir = path.join(__dirname, '../../public');
      const filePath = path.join(publicDir, ref.url.replace(/^\//, ''));
      await fs.unlink(filePath).catch(() => {});
    }
  } catch (e) { /* ignore */ }
}

export async function getImageUrlFromRef(imageRef) {
  if (!imageRef) return null;
  
  if (imageRef.type === 'sample') {
    return imageRef.url || '/image/sample-id-john-doe.png';
  }
  
  if (imageRef.type === 's3' && imageRef.key && s3Bucket) {
    try {
      const { GetObjectCommand, S3Client } = await import('@aws-sdk/client-s3');
      const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
      if (!s3Client) {
        s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
      }
      const cmd = new GetObjectCommand({ Bucket: s3Bucket, Key: imageRef.key });
      return await getSignedUrl(s3Client, cmd, { expiresIn: 3600 });
    } catch (e) { 
      console.warn('[storage] presign failed', e);
    }
  }
  
  if (imageRef.type === 'local' && imageRef.url) {
    return imageRef.url;
  }
  
  return null;
}

export default { uploadImageToStorage, deleteImageFromStorage, getImageUrlFromRef };
