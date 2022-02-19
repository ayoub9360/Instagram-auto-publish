// Packages
require('dotenv').config();
const Instagram = require('instagram-web-api')
const FileCookieStore = require('tough-cookie-filestore2')
const fs = require('fs');
const AWS = require('aws-sdk');
const nodeHtmlToImage = require('node-html-to-image')
const axios = require('axios');
const CronJob = require('cron').CronJob;

// Create my image from template
async function generateImage(quote, author) {
  console.log('Generating image...')

  // Get templates from file
  const data = fs.readFileSync('./templates/index.html', 'utf8')

  // Create my image from template
  await nodeHtmlToImage({
    output: './output/image.jpeg',
    html: data,
    content: { quote, author }
  })
    .then(() => console.log('The image was generated successfully! ✅'))
}

// Upload image in s3 and get signed URL
async function uploadFile(fileName) {
  console.log('uploading image...')

  // Set S3 bucket
  const s3 = new AWS.S3({
    accessKeyId: process.env.AWS_ID,
    secretAccessKey: process.env.AWS_SECRET,
    signatureVersion: 'v4',
  });

  // Read image
  const fileContent = fs.readFileSync(fileName);
  
  // Setting up S3 upload parameters
  const params = {
    Bucket: process.env.S3_BUCKET,
    Key: `instagram-post-${new Date().getTime()}.jpg`,
    Body: fileContent
  };

  // Uploading files to the bucket
  const key = await s3.upload(params).promise().then(data => {
    return data.key
  });

  // Get signed url
  const url = s3.getSignedUrl('getObject', {
    Bucket: process.env.S3_BUCKET,
    Key: key,
    Expires: 60 * 5
  })

  console.log('uploaded image in S3 ✅')

  return url
}

async function publishPostOnInstagram(photo, caption, post) {
  // Set Instagram account
  const { username, password } = process.env // Only required when no cookies are stored yet
  const cookieStore = new FileCookieStore('./cookies.json')
  const client = new Instagram({ username, password, cookieStore })

  // Login to the account
  console.log('Logging in...')
  await client.login()
  console.log('Logged in! ✅')

  // Publish a post
  console.log('Publishing a post...')
  const { media } = await client.uploadPhoto({ photo: photo, caption, post })
  console.log('Published! ✅')
  console.log(`link of the post: https://www.instagram.com/p/${media.code}/`)
}

async function main() {
  // Get data for the image
  let data = {}
  console.log('Getting data...')
  await axios.get('https://api.quotable.io/random')
  .then(response => {
    data.quote = response.data.content
    data.author = response.data.author
  })
  .catch(error => {
    console.log(error)
  })
  console.log('Got data! ✅')

  if (!data.quote || !data.author) return

  // Generate image
  await generateImage(data.quote, data.author)

  // Upload image in s3
  const url = await uploadFile('./output/image.jpeg')

  // Publish a picture on Instagram
  await publishPostOnInstagram(url, data.quote, 'feed')
}

// If you want to use a crod job, uncomment this

// const job = new CronJob('0 12 * * *', function() {
//   main()
// }, null, true, 'Europe/Paris');

main()