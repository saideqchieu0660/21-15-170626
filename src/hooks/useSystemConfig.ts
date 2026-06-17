import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';

export function useSystemConfig() {
  const [config, setConfig] = useState<{ supportEmail: string }>({ supportEmail: 'lgbtbd12@gmail.com' });

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'system_config', 'admin_settings'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data && data.supportEmail) {
          setConfig((prev) => ({ ...prev, supportEmail: data.supportEmail }));
        }
      }
    }, (error) => {
      console.warn(`[SystemConfig] Failed to read admin settings`, error);
    });

    return () => unsubscribe();
  }, []);

  const updateConfig = async (newConfig: Partial<{ supportEmail: string }>) => {
    try {
      await setDoc(doc(db, 'system_config', 'admin_settings'), { ...newConfig, updatedAt: new Date().toISOString() }, { merge: true });
    } catch (e) {
      console.error("Failed to update system config", e);
      throw e;
    }
  };

  return { config, updateConfig };
}
