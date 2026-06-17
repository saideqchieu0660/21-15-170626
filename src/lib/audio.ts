const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
let muted = localStorage.getItem('muted') === 'true';

export const globalAnalyser = audioCtx.createAnalyser();
globalAnalyser.fftSize = 64;
const globalGain = audioCtx.createGain();
globalGain.connect(globalAnalyser);
globalAnalyser.connect(audioCtx.destination);

export const getIsMuted = () => muted;
export const setMutedStatus = (m: boolean) => { 
  muted = m; 
  localStorage.setItem('muted', String(m)); 
};
export const toggleMute = () => { 
  muted = !muted; 
  localStorage.setItem('muted', String(muted));
  return muted;
};

export const playSound = (type: 'click' | 'success' | 'error' | 'flip' | 'correct' | 'incorrect') => {
  if (muted || audioCtx.state === 'suspended') {
     if (audioCtx.state === 'suspended') audioCtx.resume();
     if (muted) return;
  }

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.connect(gain);
  gain.connect(globalGain);

  const now = audioCtx.currentTime;

  if (type === 'click' || type === 'flip') {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(400, now + 0.1);
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
    osc.start(now);
    osc.stop(now + 0.1);
  } else if (type === 'success' || type === 'correct') {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.setValueAtTime(800, now + 0.1);
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
    osc.start(now);
    osc.stop(now + 0.2);
  } else if (type === 'error' || type === 'incorrect') {
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(200, now);
    osc.frequency.setValueAtTime(150, now + 0.2);
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
    osc.start(now);
    osc.stop(now + 0.2);
  }
};

export const playFlipSound = () => playSound('flip');
export const playCorrectSound = () => playSound('correct');
export const playIncorrectSound = () => playSound('incorrect');
export const initAudio = () => { if (audioCtx.state === 'suspended') audioCtx.resume(); };
