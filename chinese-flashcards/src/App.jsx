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
      console.log('Generating TTS for:', text);
      
      // Call our backend proxy
      const response = await fetch('http://localhost:3001/api/tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'TTS generation failed');
      }
      
      const data = await response.json();
      console.log('✓ Audio received from server');
      return data.audio;
      
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
