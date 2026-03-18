import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import { WebSocket } from 'ws';

const app = express();
const PORT = 3001;

// iFLYTEK credentials
const APP_ID = 'ga8f3190';
const API_KEY = 'd0e596d68d3bd4c89ec10293ceb68509';
const API_SECRET = 'cfe3bd189aa401d2f18c6bf9ce3acce4';
const WS_URL = 'ws://tts-api-sg.xf-yun.com/v2/tts';

app.use(cors());
app.use(express.json());

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
    
    // Build URL
    const params = new URLSearchParams();
    params.append('appid', APP_ID);
    params.append('aue', 'lame');
    params.append('auf', 'audio/L16;rate=16000');
    params.append('vcne', 'xiaoyan');
    params.append('tte', 'utf-8');
    params.append('text', Buffer.from(text).toString('base64'));
    params.append('authorization', Buffer.from(authorization).toString('base64'));
    params.append('date', date);
    
    const wsUrl = `${WS_URL}?${params.toString()}`;
    
    // Connect to iFLYTEK WebSocket
    const ws = new WebSocket(wsUrl);
    const chunks = [];
    
    ws.on('open', () => {
      console.log('✓ Connected to iFLYTEK TTS');
    });
    
    ws.on('message', (data) => {
      try {
        const response = JSON.parse(data.toString());
        
        if (response.code !== 0 && response.code !== undefined) {
          console.error('TTS API error:', response.message || response.code);
          ws.close();
          return res.status(500).json({ error: response.message || `Error ${response.code}` });
        }
        
        if (response.audio) {
          chunks.push(response.audio);
        }
        
        if (response.status === 2) {
          ws.close();
          const audioData = 'data:audio/mp3;base64,' + chunks.join('');
          console.log('✓ Audio generated successfully');
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
        const audioData = 'data:audio/mp3;base64,' + chunks.join('');
        res.json({ audio: audioData });
      }
    });
    
  } catch (error) {
    console.error('TTS generation failed:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`🎵 TTS Proxy Server running on http://localhost:${PORT}`);
});
