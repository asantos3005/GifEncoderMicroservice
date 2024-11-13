// s3Utils.js
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const fs = require('fs');
require('dotenv').config();

const s3 = new S3Client({ region: process.env.AWS_REGION });

async function uploadFileToS3(filePath, s3Key) {
  const fileStream = fs.createReadStream(filePath);
  const uploadParams = {
    Bucket: process.env.S3_BUCKET_NAME,
    Key: s3Key,
    Body: fileStream,
  };

  await s3.send(new PutObjectCommand(uploadParams));
  return `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Key}`;
}

module.exports = { uploadFileToS3 };