const express = require('express');
const multer = require('multer');
const cors = require('cors');
const { createCanvas, loadImage } = require('canvas');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const fs = require('fs');
const path = require('path');

// Set FFmpeg path
ffmpeg.setFfmpegPath(ffmpegInstaller.path);
console.log('FFmpeg Path:', ffmpegInstaller.path);

const app = express();
app.use(cors());

// Create directories if they don't exist
const dirs = ['uploads', 'temp', 'output'];
dirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Configure multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ storage });

// Function to create video from frames
const createVideo = (frames, outputPath) => {
  return new Promise((resolve, reject) => {
    console.log('Starting video creation...');
    const command = ffmpeg();

    command
      .input(path.join('temp', 'frame_%04d.png'))
      .inputFPS(30)
      .output(outputPath)
      .videoCodec('libx264')
      .outputOptions([
        '-pix_fmt yuv420p',
        '-preset ultrafast',
        '-movflags +faststart'
      ])
      .on('start', (commandLine) => {
        console.log('FFmpeg process started:', commandLine);
      })
      .on('error', (err, stdout, stderr) => {
        console.error('FFmpeg error:', err);
        console.error('FFmpeg stderr:', stderr);
        reject(err);
      })
      .on('end', () => {
        console.log('FFmpeg process completed');
        resolve();
      })
      .run();
  });
};

app.post('/api/generate-animation', upload.single('image'), async (req, res) => {
  console.log('Starting animation generation...');
  console.log('Background color:', req.body.backgroundColor);
  
  if (!req.file) {
    return res.status(400).send('No file uploaded');
  }

  try {
    const backgroundColor = req.body.backgroundColor || 'white';
    console.log('Using background color:', backgroundColor);
    const frames = await generateFrames(req.file.path, backgroundColor);
    const outputPath = path.join('output', `${Date.now()}.mp4`);
    
    await createVideo(frames, outputPath);

    res.sendFile(path.resolve(outputPath), {}, (err) => {
      if (err) console.error('Error sending file:', err);
      
      // Cleanup
      setTimeout(() => {
        try {
          fs.unlinkSync(req.file.path);
          frames.forEach(frame => fs.existsSync(frame) && fs.unlinkSync(frame));
          fs.existsSync(outputPath) && fs.unlinkSync(outputPath);
        } catch (e) {
          console.error('Cleanup error:', e);
        }
      }, 1000);
    });
  } catch (error) {
    console.error('Error in animation generation:', error);
    res.status(500).send('Failed to generate animation');
  }
});

async function generateFrames(imagePath, backgroundColor = 'white') {
  const canvas = createCanvas(540, 540);
  const ctx = canvas.getContext('2d');
  const img = await loadImage(imagePath);

  const frames = [];
  const scale = Math.min(270 / img.width, 270 / img.height);
  const scaledWidth = img.width * scale;
  const scaledHeight = img.height * scale;

  // Animation parameters - adjusted for 5 seconds total
  const fps = 30;
  const unfoldDuration = 2; // 2 seconds for unfolding
  const unfoldFrames = fps * unfoldDuration; // 60 frames for unfolding
  const holdDuration = 3; // 3 seconds for gentle wiggle
  const holdFrames = fps * holdDuration; // 90 frames for holding/wiggling
  
  // Use a more vibrant green if 'green' is selected
  const bgColor = backgroundColor === 'green' ? '#00FF00' : backgroundColor;
  
  // Generate unfolding frames (2 seconds)
  for (let i = 0; i <= unfoldFrames; i++) {
    const progress = i / unfoldFrames;
    
    // Clear canvas with selected background color
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, 540, 540);
    
    ctx.save();
    ctx.translate(270, 270); // Center of canvas
    
    // Animation effects
    const scaleEffect = 0.2 + (0.8 * progress);
    const rotationAngle = (1 - progress) * Math.PI / 4;
    
    ctx.rotate(rotationAngle);
    ctx.scale(scaleEffect, scaleEffect);
    
    // Add shadow for 3D effect
    ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
    ctx.shadowBlur = 20 * (1 - progress);
    ctx.shadowOffsetX = 10 * (1 - progress);
    ctx.shadowOffsetY = 10 * (1 - progress);
    
    // Draw image
    ctx.drawImage(
      img,
      -scaledWidth/2,
      -scaledHeight/2,
      scaledWidth,
      scaledHeight
    );
    
    ctx.restore();
    
    // Save frame
    const frameNumber = i.toString().padStart(4, '0');
    const framePath = path.join('temp', `frame_${frameNumber}.png`);
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(framePath, buffer);
    frames.push(framePath);
  }

  // Generate gentle wiggle frames (3 seconds)
  for (let i = 0; i < holdFrames; i++) {
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, 540, 540);
    
    ctx.save();
    ctx.translate(270, 270);
    
    // Subtle wiggle effect
    const wiggleX = Math.sin(i * 0.1) * 2; // Reduced wiggle amount
    const wiggleY = Math.cos(i * 0.1) * 1; // Vertical wiggle
    const wiggleRotation = Math.sin(i * 0.1) * 0.02; // Subtle rotation
    
    ctx.translate(wiggleX, wiggleY);
    ctx.rotate(wiggleRotation);
    
    // Draw the fully unfolded image with wiggle
    ctx.drawImage(
      img,
      -scaledWidth/2,
      -scaledHeight/2,
      scaledWidth,
      scaledHeight
    );
    
    ctx.restore();
    
    // Save frame
    const frameNumber = (i + unfoldFrames + 1).toString().padStart(4, '0');
    const framePath = path.join('temp', `frame_${frameNumber}.png`);
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(framePath, buffer);
    frames.push(framePath);
  }

  return frames;
}

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 