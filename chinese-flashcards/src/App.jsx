import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import './App.css';

// iFLYTEK API credentials
const APP_ID = 'ga8f3190';
const API_KEY = 'd0e596d68d3bd4c89ec10293ceb68509';
const API_SECRET = 'cfe3bd189aa401d2f18c6bf9ce3acce4';
const WS_URL = 'ws://tts-api-sg.xf-yun.com/v2/tts';

function App() {
  const [chapters, setChapters] = useState({});
  const [selectedChapter, setSelectedChapter] = useState(null);
  const [flippedCards, setFlippedCards] = useState({});
  const [practiceMode, setPracticeMode] = useState(false);
  const [mixedCards, setMixedCards] = useState([]);
  const [audioCache, setAudioCache] = useState({});
  const [playingId, setPlayingId] = useState(null);

  useEffect(() => {
    loadExcelData();
  }, []);

  const loadExcelData = async () => {
    try {
      const data = await fetch('/Chinese Characters Recognition and Reading Chart (with Pinyin and English).xlsx');
      const arrayBuffer = await data.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      
      parseChapterData(jsonData);
    } catch (error) {
      console.error('Error loading Excel file:', error);
    }
  };

  const parseChapterData = (data) => {
    const chapterMap = {};
    const chapterHeaders = [];
    
    // Row 2 contains chapter headers
    const headerRow = data[1];
    let currentChapter = null;
    let chapterStartCol = 0;
    
    // Identify chapter columns
    for (let col = 0; col < headerRow.length; col++) {
      const cell = headerRow[col];
      if (cell && typeof cell === 'string') {
        if (currentChapter) {
          chapterHeaders.push({ name: currentChapter, start: chapterStartCol, end: col - 1 });
        }
        currentChapter = cell;
        chapterStartCol = col;
      }
    }
    
    if (currentChapter) {
      chapterHeaders.push({ name: currentChapter, start: chapterStartCol, end: headerRow.length - 1 });
    }
    
    // Extract characters for each chapter (starting from row 3)
    chapterHeaders.forEach(chapter => {
      const chars = [];
      
      for (let row = 2; row < data.length; row++) {
        const rowData = data[row];
        if (!rowData) continue;
        
        for (let col = chapter.start; col <= chapter.end; col += 4) {
          const character = rowData[col];
          const pinyin = rowData[col + 1];
          const english = rowData[col + 2];
          
          if (character && typeof character === 'string') {
            chars.push({
              id: `${chapter.name}-${row}-${col}`,
              character,
              pinyin: pinyin || '',
              english: english || ''
            });
          }
        }
      }
      
      if (chars.length > 0) {
        chapterMap[chapter.name] = chars;
      }
    });
    
    setChapters(chapterMap);
  };

  const handleCardFlip = (cardId) => {
    setFlippedCards(prev => ({
      ...prev,
      [cardId]: !prev[cardId]
    }));
  };

  const startPracticeMode = () => {
    const allCards = Object.values(chapters).flat();
    const shuffled = [...allCards].sort(() => Math.random() - 0.5);
    setMixedCards(shuffled);
    setPracticeMode(true);
    setFlippedCards({});
  };

  const exitPracticeMode = () => {
    setPracticeMode(false);
    setMixedCards([]);
    setFlippedCards({});
  };

  const resetCards = () => {
    setFlippedCards({});
  };

  const generateTTS = async (text) => {
    try {
      // Use iFLYTEK's simpler authentication method for WebSocket
      const date = new Date().toUTCString();
      const host = 'tts-api-sg.xf-yun.com';
      
      // Build the signature string exactly as iFLYTEK expects
      const signatureOrigin = `host: ${host}\ndate: ${date}\nGET /v2/tts HTTP/1.1`;
      
      // HMAC-SHA256 signature
      const encoder = new TextEncoder();
      const keyData = encoder.encode(API_SECRET);
      const messageData = encoder.encode(signatureOrigin);
      
      const key = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );
      
      const signature = await crypto.subtle.sign('HMAC', key, messageData);
      const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signature)));
      
      // Authorization header format
      const authorization = `api_key="${API_KEY}", algorithm="hmac-sha256", headers="host date request-line", signature="${signatureBase64}"`;
      
      // Build WebSocket URL - don't encode authorization and date twice
      const params = new URLSearchParams();
      params.append('appid', APP_ID);
      params.append('aue', 'lame');
      params.append('auf', 'audio/L16;rate=16000');
      params.append('vcne', 'xiaoyan');
      params.append('tte', 'utf-8');
      params.append('text', btoa(unescape(encodeURIComponent(text)))); // Base64 encode text
      params.append('authorization', btoa(authorization)); // Base64 encode authorization
      params.append('date', date);
      
      const wsUrl = `${WS_URL}?${params.toString()}`;
      
      console.log('Connecting to TTS WebSocket...');
      
      return new Promise((resolve, reject) => {
        const ws = new WebSocket(wsUrl);
        const chunks = [];
        let hasError = false;
        
        ws.onopen = () => {
          console.log('✓ TTS WebSocket connected successfully');
        };
        
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log('TTS response:', data);
            
            if (data.code !== 0 && data.code !== undefined) {
              console.error('TTS API error:', data.message || data.code);
              hasError = true;
              ws.close();
              reject(new Error(data.message || `Error code: ${data.code}`));
              return;
            }
            
            if (data.audio) {
              chunks.push(data.audio);
            }
            
            if (data.status === 2) {
              ws.close();
              if (!hasError && chunks.length > 0) {
                const audioData = 'data:audio/mp3;base64,' + chunks.join('');
                console.log('✓ Audio generated successfully');
                resolve(audioData);
              }
            }
          } catch (e) {
            console.error('Error parsing TTS response:', e);
          }
        };
        
        ws.onerror = (error) => {
          console.error('✗ TTS WebSocket error:', error);
          if (!hasError) {
            reject(error);
          }
        };
        
        ws.onclose = () => {
          if (!hasError && chunks.length > 0) {
            const audioData = 'data:audio/mp3;base64,' + chunks.join('');
            resolve(audioData);
          }
        };
      });
    } catch (error) {
      console.error('✗ TTS generation failed:', error);
      throw error;
    }
  };

  const playAudio = async (cardId, character) => {
    if (playingId === cardId) {
      // Stop current playback
      const existingAudio = document.getElementById(`audio-${cardId}`);
      if (existingAudio) {
        existingAudio.pause();
        existingAudio.currentTime = 0;
      }
      setPlayingId(null);
      return;
    }
    
    try {
      // Check cache first
      if (audioCache[character]) {
        const audio = new Audio(audioCache[character]);
        audio.id = `audio-${cardId}`;
        audio.play();
        setPlayingId(cardId);
        audio.onended = () => setPlayingId(null);
        return;
      }
      
      // Generate new audio
      const audioData = await generateTTS(character);
      setAudioCache(prev => ({ ...prev, [character]: audioData }));
      
      const audio = new Audio(audioData);
      audio.id = `audio-${cardId}`;
      audio.play();
      setPlayingId(cardId);
      audio.onended = () => setPlayingId(null);
    } catch (error) {
      console.error('Audio playback failed:', error);
    }
  };

  const cardsToDisplay = practiceMode ? mixedCards : (selectedChapter ? chapters[selectedChapter] : []);

  if (!selectedChapter && !practiceMode) {
    return (
      <div className="app">
        <header className="header">
          <h1>🇨🇳 Chinese Flashcards</h1>
          <p className="subtitle">Master Chinese characters by chapter</p>
        </header>
        
        <main className="main-content">
          <button className="practice-btn" onClick={startPracticeMode}>
            🎯 Mixed Practice Mode
          </button>
          
          <div className="chapter-grid">
            {Object.entries(chapters).map(([chapterName, chars]) => (
              <div 
                key={chapterName} 
                className="chapter-folder"
                onClick={() => setSelectedChapter(chapterName)}
              >
                <div className="folder-icon">📁</div>
                <h3>{chapterName}</h3>
                <p className="char-count">{chars.length} characters</p>
              </div>
            ))}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="header">
        <button className="back-btn" onClick={practiceMode ? exitPracticeMode : () => setSelectedChapter(null)}>
          ← Back
        </button>
        <h1>{practiceMode ? '🎯 Mixed Practice' : selectedChapter}</h1>
        <div className="header-actions">
          <button className="reset-btn" onClick={resetCards}>
            🔄 Reset Cards
          </button>
        </div>
      </header>
      
      <div className="stats-bar">
        <span>Total: {cardsToDisplay.length} cards</span>
        <span>Flipped: {Object.values(flippedCards).filter(v => v).length}</span>
      </div>
      
      <main className="cards-container">
        {cardsToDisplay.map((card) => (
          <div
            key={card.id}
            className={`flashcard ${flippedCards[card.id] ? 'flipped' : ''}`}
            onClick={() => handleCardFlip(card.id)}
          >
            <div className="flashcard-inner">
              <div className="flashcard-front">
                <div className="character">{card.character}</div>
                <button 
                  className="audio-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    playAudio(card.id, card.character);
                  }}
                >
                  {playingId === card.id ? '🔊' : '🔈'}
                </button>
                <div className="hint">Click to flip</div>
              </div>
              <div className="flashcard-back">
                <div className="pinyin">{card.pinyin}</div>
                <div className="english">{card.english}</div>
              </div>
            </div>
          </div>
        ))}
      </main>
    </div>
  );
}

export default App;
