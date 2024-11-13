// lambdaNotifier.js (without DynamoDB)

const AWS = require('aws-sdk');
const sns = new AWS.SNS();

exports.handler = async (event) => {
  const record = event.Records[0];
  const bucket = record.s3.bucket.name;
  const key = record.s3.object.key;
  const gifUrl = `https://${bucket}.s3.amazonaws.com/${key}`;
  
  // Log or send a notification with the GIF URL
  console.log(`New GIF uploaded: ${gifUrl}`);

  // (Optional) Notify frontend via SNS or another notification mechanism
  const snsParams = {
    Message: `GIF is ready: ${gifUrl}`,
    TopicArn: process.env.SNS_TOPIC_ARN,
  };
  try {
    await sns.publish(snsParams).promise();
    console.log(`Notification sent for GIF URL ${gifUrl}`);
  } catch (error) {
    console.error('Error sending SNS notification:', error);
  }
};