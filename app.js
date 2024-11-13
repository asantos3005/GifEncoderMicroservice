const express = require('express');
const dotenv = require('dotenv');
const { createGifFromImages } = require('./gifEncoder');
const { uploadFileToS3 } = require('./s3Utils');
const path = require('path');
const fs = require('fs');
const { S3Client, GetObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const { SQSClient, ReceiveMessageCommand, DeleteMessageCommand } = require('@aws-sdk/client-sqs');
const { v4: uuidv4 } = require('uuid');

dotenv.config();

const app = express();
const region = process.env.AWS_REGION;

// Initialize AWS SDK v3 clients
const s3Client = new S3Client({ region });
const sqsClient = new SQSClient({ region });

async function listImagesInFolder(useruniqueid, gifId) {
  const s3Prefix = `${useruniqueid}/${gifId}/`;
  const bucketName = process.env.S3_BUCKET_NAME;

  const params = {
    Bucket: bucketName,
    Prefix: s3Prefix,
  };

  const command = new ListObjectsV2Command(params);
  const response = await s3Client.send(command);
  return response.Contents.map(item => item.Key); // Return an array of S3 keys for each image
}

function cleanUpDirectory(directoryPath) {
  try {
    if (fs.existsSync(directoryPath)) {
      fs.readdirSync(directoryPath).forEach(file => {
        const filePath = path.join(directoryPath, file);
        try {
          fs.unlinkSync(filePath);
        } catch (error) {
          console.error(`Error deleting file ${filePath}:`, error);
        }
      });

      for (let i = 0; i < 3; i++) {
        try {
          fs.rmSync(directoryPath, { recursive: true, force: true });
          console.log(`Directory ${directoryPath} and its contents have been deleted.`);
          break;
        } catch (error) {
          if (error.code === 'EPERM') {
            console.error(`Directory ${directoryPath} is locked, retrying in 100ms...`);
            Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
          } else {
            console.error(`Failed to delete directory ${directoryPath}:`, error);
            break;
          }
        }
      }
    }
  } catch (error) {
    console.error(`Error cleaning up directory ${directoryPath}:`, error);
  }
}

async function downloadImageFromS3(s3Key, downloadPath) {
  const params = {
    Bucket: process.env.S3_BUCKET_NAME,
    Key: s3Key,
  };

  const command = new GetObjectCommand(params);
  const response = await s3Client.send(command);

  const fileStream = fs.createWriteStream(downloadPath);
  response.Body.pipe(fileStream);

  return new Promise((resolve, reject) => {
    fileStream.on('finish', resolve);
    fileStream.on('error', reject);
  });
}

async function processMessage(message) {
  const { useruniqueid, gifId } = JSON.parse(message.Body);
  const tempDir = path.join(__dirname, 'temp', gifId);

  fs.mkdirSync(tempDir, { recursive: true });

  try {
    const imageKeys = await listImagesInFolder(useruniqueid, gifId);

    const localImagePaths = [];
    for (const s3Key of imageKeys) {
      const fileName = path.basename(s3Key);
      const downloadPath = path.join(tempDir, fileName);
      await downloadImageFromS3(s3Key, downloadPath);
      localImagePaths.push(downloadPath);
    }

    const outputFilePath = path.join(tempDir, `${gifId}.gif`);
    await createGifFromImages(localImagePaths, outputFilePath);

    const gifS3Key = `${useruniqueid}/gifs/${gifId}.gif`;
    const gifUrl = await uploadFileToS3(outputFilePath, gifS3Key);
    console.log(`GIF created and uploaded successfully: ${gifUrl}`);

    cleanUpDirectory(tempDir);
  } catch (error) {
    console.error('Error processing message:', error);
    cleanUpDirectory(tempDir);
  }
}

async function pollQueue() {
  const params = {
    QueueUrl: process.env.SQS_QUEUE_URL,
    MaxNumberOfMessages: 1,
    WaitTimeSeconds: 20,
  };

  try {
    const command = new ReceiveMessageCommand(params);
    const data = await sqsClient.send(command);

    if (data.Messages) {
      for (const message of data.Messages) {
        await processMessage(message);

        const deleteParams = {
          QueueUrl: process.env.SQS_QUEUE_URL,
          ReceiptHandle: message.ReceiptHandle,
        };
        const deleteCommand = new DeleteMessageCommand(deleteParams);
        await sqsClient.send(deleteCommand);
        console.log('Message processed and deleted');
      }
    }

    setImmediate(pollQueue);
  } catch (error) {
    console.error('Error receiving message:', error);
    setImmediate(pollQueue);
  }
}

pollQueue();

app.listen(4000, () => console.log('GIF Encoding Microservice is running on port 4000'));