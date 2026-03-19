import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import { WebSocket } from 'ws';

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// iFLYTEK credentials
const APP_ID = 'ga8f3190';
const API_KEY = 'd0e596d68d3bd4c89ec10293ceb68509';
const API_SECRET = 'cfe3bd189aa401d2f18c6bf9ce3acce4';

app.use(cors());
app.use(express.json());

// Serve static files from the Vite build directory
app.use(express.static(path.join(__dirname, 'dist')));

app.post('/api/tts', async (req, res) => {
  const { text } = req.body;
  
  if (!text) {
    return res.status(400).json({ error: 'Text is required' });
  }
  
  try {
    const date = new Date().toUTCString();
    const host = 'tts-api-sg.xf-yun.com';
    
    // Create signature
    const signatureOrigin = `host: ${host}\ndate: ${date}\nGET /v2/tts HTTP/1.1`;
    const signature = crypto
      .createHmac('sha256', API_SECRET)
      .update(signatureOrigin)
      .digest('base64');
    
    const authorization = `api_key="${API_KEY}", algorithm="hmac-sha256", headers="host date request-line", signature="${signature}"`;
    
    const authorizationBase64 = Buffer.from(authorization).toString('base64');
    
    // Build URL according to standard iFlytek WebSocket v2 API
    const wsUrl = `wss://${host}/v2/tts?authorization=${authorizationBase64}&date=${encodeURIComponent(date)}&host=${host}`;
    
    // Connect to iFLYTEK WebSocket
    const ws = new WebSocket(wsUrl);
    const chunks = [];
    
    ws.on('open', () => {
      console.log('✓ Connected to iFLYTEK TTS');
      const textBase64 = Buffer.from(text).toString('base64');
      const payload = {
        common: { app_id: APP_ID },
        business: { aue: "lame", sfl: 1, auf: "audio/L16;rate=16000", vcn: "xiaoyan", tte: "utf8", speed: 30 },
        data: { status: 2, text: textBase64 }
      };
      ws.send(JSON.stringify(payload));
    });
    
    ws.on('message', (data) => {
      try {
        const response = JSON.parse(data.toString());
        
        if (response.code !== 0 && response.code !== undefined) {
          console.error('TTS API error:', response.message || response.code);
          ws.close();
          return res.status(500).json({ error: response.message || `Error ${response.code}` });
        }
        
        if (response.data && response.data.audio) {
          chunks.push(response.data.audio);
        }
        
        if (response.data && response.data.status === 2) {
          ws.close();
          const audioData = 'data:audio/mpeg;base64,' + chunks.join('');
          res.json({ audio: audioData });
        }
      } catch (e) {
        console.error('Error parsing response:', e);
      }
    });
    
    ws.on('error', (error) => {
      console.error('✗ WebSocket error:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'WebSocket connection failed' });
      }
    });
    
    ws.on('close', () => {
      if (chunks.length > 0 && !res.headersSent) {
        const audioData = 'data:audio/mpeg;base64,' + chunks.join('');
        res.json({ audio: audioData });
      }
    });
    
  } catch (error) {
    console.error('TTS generation failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// For any other request, send back the index.html from the build folder
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🎵 Flashcards Server running on port ${PORT}`);
});
