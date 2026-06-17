import { playSound } from '../lib/audio';
import { useSoundContext } from '../components/SoundProvider';

export const useSound = () => {
  const { isSoundEnabled } = useSoundContext();
  
  const play = (soundType: 'click' | 'success' | 'error') => {
    if (isSoundEnabled) {
      playSound(soundType);
    }
  };
  
  return {
    click: () => play('click'),
    success: () => play('success'),
    error: () => play('error'),
  };
};
