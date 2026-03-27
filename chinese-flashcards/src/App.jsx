import { useState, useEffect } from 'react';
import './App.css';

// iFLYTEK API credentials
const APP_ID = 'ga8f3190';
const API_KEY = 'd0e596d68d3bd4c89ec10293ceb68509';
const API_SECRET = 'cfe3bd189aa401d2f18c6bf9ce3acce4';


function App() {
  const [chapters, setChapters] = useState({});
  const [chapterOrder, setChapterOrder] = useState([]);
  const [selectedChapter, setSelectedChapter] = useState(null);
  const [flippedCards, setFlippedCards] = useState({});
  const [practiceMode, setPracticeMode] = useState(false);
  const [mixedCards, setMixedCards] = useState([]);
  const [audioCache, setAudioCache] = useState({});
  const [playingId, setPlayingId] = useState(null);
  const [charReusage, setCharReusage] = useState({});
  const [selectedChar, setSelectedChar] = useState(null);
  const [showReusage, setShowReusage] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const response = await fetch('/data/chapters.json');
      const index = await response.json();
      
      const chapterDataMap = {};
      
      // Load all chapter files in parallel
      await Promise.all(index.map(async (chapter) => {
        const charResponse = await fetch(`/data/${chapter.file}`);
        const characters = await charResponse.json();
        chapterDataMap[chapter.name] = characters;
      }));

      // Preserve the original order from chapters.json
      setChapterOrder(index.map(ch => ch.name));
      setChapters(chapterDataMap);
      
      // Compute character reusage
      computeReusage(chapterDataMap);
    } catch (error) {
      console.error('Error loading JSON data:', error);
    }
  };

  const computeReusage = (dataMap) => {
    const usageMap = {};
    Object.values(dataMap).flat().forEach(wordObj => {
      const chars = wordObj.character.split('');
      chars.forEach(char => {
        // Only count actual Chinese characters (rough filter)
        if (/[\u4e00-\u9fa5]/.test(char)) {
          if (!usageMap[char]) usageMap[char] = [];
          // Avoid duplicates if a character appears twice in the same word entry (unlikely but safe)
          if (!usageMap[char].find(w => w.id === wordObj.id)) {
            usageMap[char].push(wordObj);
          }
        }
      });
    });

    // Filter to only those reused (at least 2 words)
    const filteredUsage = {};
    Object.keys(usageMap).forEach(char => {
      if (usageMap[char].length > 1) {
        filteredUsage[char] = usageMap[char];
      }
    });

    setCharReusage(filteredUsage);
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

  const startReusageMode = () => {
    setShowReusage(true);
    setSelectedChar(null);
    setFlippedCards({});
  };

  const exitReusageMode = () => {
    setShowReusage(false);
    setSelectedChar(null);
    setFlippedCards({});
  };

  const resetCards = () => {
    setFlippedCards({});
  };

  const generateTTS = async (text) => {
    try {
      console.log('Generating TTS for:', text);
      
      // Call our backend proxy
      const response = await fetch('/api/tts', {
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
      // Check cache first (cache stores Blob URLs)
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

      // Convert base64 data URI → Blob URL (browsers play Blob URLs reliably)
      const base64 = audioData.split(',')[1];
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: 'audio/mpeg' });
      const blobUrl = URL.createObjectURL(blob);

      setAudioCache(prev => ({ ...prev, [character]: blobUrl }));
      
      const audio = new Audio(blobUrl);
      audio.id = `audio-${cardId}`;
      audio.play();
      setPlayingId(cardId);
      audio.onended = () => setPlayingId(null);
    } catch (error) {
      console.error('Audio playback failed:', error);
    }
  };

  const cardsToDisplay = practiceMode ? mixedCards : (selectedChapter ? chapters[selectedChapter] : []);

  if (!selectedChapter && !practiceMode && !showReusage) {
    return (
      <div className="app">
        <header className="header">
          <div className="header-center">
            <h1>中文闪卡</h1>
            <p className="subtitle">Chinese Flashcards — select a chapter to begin</p>
          </div>
        </header>
        
        <main className="main-content">
          <div className="top-nav">
            <button className="practice-btn" onClick={startPracticeMode}>
              Mixed Practice
            </button>
            <button className="reusage-btn" onClick={startReusageMode}>
              Character Reusage
            </button>
          </div>
          
          <div className="chapter-grid">
            {chapterOrder.map((chapterName) => {
              const chars = chapters[chapterName];
              if (!chars) return null;
              return (
              <div 
                key={chapterName} 
                className="chapter-folder"
                onClick={() => setSelectedChapter(chapterName)}
              >
                <span className="folder-icon">�</span>
                <h3>{chapterName}</h3>
                <p className="char-count">{chars.length} characters</p>
              </div>
                          );
            })}
          </div>
        </main>
      </div>
    );
  }

  if (showReusage && !selectedChar) {
    return (
      <div className="app">
        <header className="header">
          <button className="back-btn" onClick={exitReusageMode}>
            ← Back
          </button>
          <div className="header-center">
            <h1>Character Reusage</h1>
            <p className="subtitle">Common characters found in multiple words</p>
          </div>
        </header>

        <main className="main-content">
          <div className="char-reusage-grid">
            {Object.keys(charReusage).sort((a, b) => charReusage[b].length - charReusage[a].length).map(char => (
              <div 
                key={char} 
                className="reusage-card"
                onClick={() => setSelectedChar(char)}
              >
                <div className="reusage-char">{char}</div>
                <div className="reusage-count">{charReusage[char].length} words</div>
              </div>
            ))}
          </div>
        </main>
      </div>
    );
  }

  const displayList = selectedChar ? charReusage[selectedChar] : cardsToDisplay;
  const pageTitle = selectedChar ? `Words with "${selectedChar}"` : (practiceMode ? 'Mixed Practice' : selectedChapter);
  const handleBack = () => {
    if (selectedChar) {
      setSelectedChar(null);
    } else if (practiceMode) {
      exitPracticeMode();
    } else if (showReusage) {
      exitReusageMode();
    } else {
      setSelectedChapter(null);
    }
  };

  return (
    <div className="app">
      <header className="header">
        <button className="back-btn" onClick={handleBack}>
          ← Back
        </button>
        <div className="header-center">
          <h1>{pageTitle}</h1>
        </div>
        <button className="reset-btn" onClick={resetCards}>
          Reset
        </button>
      </header>
      
      <div className="stats-bar">
        <span>Total: {displayList.length} cards</span>
        <span>Flipped: {Object.values(flippedCards).filter(v => v).length}</span>
      </div>
      
      <main className="cards-container">
        {displayList.map((card) => (
          <div
            key={card.id + (selectedChar ? '-reusage' : '')}
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
