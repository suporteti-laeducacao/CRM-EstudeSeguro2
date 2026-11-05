import { useCallback, useEffect, useRef, useState } from 'react';

interface SellerStats {
  name: string;
  totalAmount: number;
}

interface UseRankingSoundReturn {
  isMuted: boolean;
  setIsMuted: (muted: boolean) => void;
  volume: number;
  setVolume: (volume: number) => void;
  changedPositions: Set<string>;
  checkForOvertakes: (newStats: SellerStats[]) => void;
}

// F1-style overtake sound using Web Audio API
const createOvertakeSound = (audioContext: AudioContext, volume: number): void => {
  const now = audioContext.currentTime;
  
  // Create oscillators for the "whoosh" effect
  const oscillator1 = audioContext.createOscillator();
  const oscillator2 = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  const filter = audioContext.createBiquadFilter();
  
  // Connect nodes
  oscillator1.connect(filter);
  oscillator2.connect(filter);
  filter.connect(gainNode);
  gainNode.connect(audioContext.destination);
  
  // Configure oscillators for engine-like sound
  oscillator1.type = 'sawtooth';
  oscillator2.type = 'square';
  
  // Frequency sweep (high to low for Doppler effect)
  oscillator1.frequency.setValueAtTime(800, now);
  oscillator1.frequency.exponentialRampToValueAtTime(200, now + 0.3);
  oscillator1.frequency.exponentialRampToValueAtTime(100, now + 0.5);
  
  oscillator2.frequency.setValueAtTime(600, now);
  oscillator2.frequency.exponentialRampToValueAtTime(150, now + 0.3);
  oscillator2.frequency.exponentialRampToValueAtTime(80, now + 0.5);
  
  // Filter for more realistic sound
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(2000, now);
  filter.frequency.exponentialRampToValueAtTime(500, now + 0.5);
  
  // Volume envelope
  gainNode.gain.setValueAtTime(0, now);
  gainNode.gain.linearRampToValueAtTime(volume * 0.3, now + 0.05);
  gainNode.gain.linearRampToValueAtTime(volume * 0.5, now + 0.15);
  gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
  
  // Start and stop
  oscillator1.start(now);
  oscillator2.start(now);
  oscillator1.stop(now + 0.5);
  oscillator2.stop(now + 0.5);
};

export const useRankingSound = (): UseRankingSoundReturn => {
  const [isMuted, setIsMuted] = useState(() => {
    const stored = localStorage.getItem('ranking-sound-muted');
    return stored === 'true';
  });
  
  const [volume, setVolume] = useState(() => {
    const stored = localStorage.getItem('ranking-sound-volume');
    return stored ? parseFloat(stored) : 0.5;
  });
  
  const [changedPositions, setChangedPositions] = useState<Set<string>>(new Set());
  const previousRanking = useRef<Map<string, number>>(new Map());
  const audioContextRef = useRef<AudioContext | null>(null);

  // Persist preferences
  useEffect(() => {
    localStorage.setItem('ranking-sound-muted', String(isMuted));
  }, [isMuted]);

  useEffect(() => {
    localStorage.setItem('ranking-sound-volume', String(volume));
  }, [volume]);

  // Initialize audio context on first user interaction
  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    return audioContextRef.current;
  }, []);

  const playOvertakeSound = useCallback(() => {
    if (isMuted) return;
    
    try {
      const audioContext = getAudioContext();
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }
      createOvertakeSound(audioContext, volume);
    } catch (error) {
      console.error('Failed to play overtake sound:', error);
    }
  }, [isMuted, volume, getAudioContext]);

  const checkForOvertakes = useCallback((newStats: SellerStats[]) => {
    const newPositions = new Map<string, number>();
    const overtakes = new Set<string>();
    
    newStats.forEach((stat, index) => {
      newPositions.set(stat.name, index);
      
      const previousPosition = previousRanking.current.get(stat.name);
      if (previousPosition !== undefined && previousPosition > index) {
        // This seller moved up in the ranking
        overtakes.add(stat.name);
      }
    });
    
    if (overtakes.size > 0 && previousRanking.current.size > 0) {
      playOvertakeSound();
      setChangedPositions(overtakes);
      
      // Clear the highlight after animation
      setTimeout(() => {
        setChangedPositions(new Set());
      }, 2000);
    }
    
    previousRanking.current = newPositions;
  }, [playOvertakeSound]);

  return {
    isMuted,
    setIsMuted,
    volume,
    setVolume,
    changedPositions,
    checkForOvertakes,
  };
};
