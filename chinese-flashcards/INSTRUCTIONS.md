# Chinese Flashcard App with TTS Audio

## Features
- 📚 Chapter-based organization of Chinese characters
- 🎴 Flip cards for practice
- 🔊 Text-to-Speech audio pronunciation powered by iFLYTEK
- 🎯 Mixed practice mode with all characters

## Running the Application

### Option 1: Run Both Servers Together (Recommended)
```bash
npm run start
```

### Option 2: Run Servers Separately

**Terminal 1 - Backend TTS Server:**
```bash
npm run server
```

**Terminal 2 - Frontend Dev Server:**
```bash
npm run dev
```

Then open http://localhost:5173 in your browser

## Usage
1. Select a chapter folder to view its characters
2. Click on any flashcard to flip it
3. Click the 🔈 button to hear the pronunciation
4. Use "Mixed Practice Mode" to test yourself with random characters

## Technical Notes
- The backend server runs on port 3001
- The frontend runs on port 5173
- Audio is cached after first generation for faster playback
- Requires internet connection for TTS API
