const { createCanvas, Image } = require('canvas'); // Import Image from canvas
const GIFEncoder = require('gif-encoder-2');
const { createWriteStream } = require('fs');

async function createGifFromImages(imagePaths, outputPath, algorithm = 'neuquant') {
    return new Promise(async (resolve, reject) => {
      try {
        // Sort the files to maintain sequence - Part of the documentation but could interfere with custom sorting.
        //imagePaths.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
  
        if (imagePaths.length === 0) {
          throw new Error('No image files found.');
        }
  
        // Find the width and height of the first image
        const [width, height] = await new Promise(resolveImage => {
          const image = new Image();
          image.onload = () => resolveImage([image.width, image.height]);
          image.src = imagePaths[0];
        });
  
        const writeStream = createWriteStream(outputPath);
        writeStream.on('close', resolve);
  
        const encoder = new GIFEncoder(width, height, algorithm);
        encoder.createReadStream().pipe(writeStream);
        encoder.start();
        encoder.setDelay(500); // Set frame delay
  
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');
  
        // Draw an image for each file and add frame to encoder
        for (const imagePath of imagePaths) {
          await new Promise(resolveFrame => {
            const image = new Image();
            image.onload = () => {
              ctx.drawImage(image, 0, 0);
              encoder.addFrame(ctx);
              resolveFrame();
            };
            image.src = imagePath;
          });
        }
  
        encoder.finish();
      } catch (error) {
        reject(error);
      }
    });
  }

  module.exports = { createGifFromImages };