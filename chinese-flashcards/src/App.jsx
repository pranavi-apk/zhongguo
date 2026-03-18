import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import './App.css';

function App() {
  const [chapters, setChapters] = useState({});
  const [selectedChapter, setSelectedChapter] = useState(null);
  const [flippedCards, setFlippedCards] = useState({});
  const [practiceMode, setPracticeMode] = useState(false);
  const [mixedCards, setMixedCards] = useState([]);

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
