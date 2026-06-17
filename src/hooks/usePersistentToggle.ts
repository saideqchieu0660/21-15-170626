import { useState, useEffect, useCallback } from 'react';
import { db, dbService } from '../lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { store } from '../lib/store';

/**
 * Custom Hook đồng bộ trạng thái switch/toggle toàn server dành cho Admin.
 * - Lắng nghe thay đổi từ Firestore (system_config/api_toggles) bằng onSnapshot để mọi client đều khớp real-time.
 * - Dispatch thêm CustomEvent `persistent_toggle_changed` nếu cần báo hiệu chéo cho Vanilla JS/DOM thường ngoài React.
 * - Tự động chặn ghi nếu người dùng không phải admin/teacher.
 */
export function usePersistentToggle(key: string, defaultValue: boolean = false) {
  const [value, setValue] = useState<boolean>(defaultValue);
  const [isReady, setIsReady] = useState(false);
  
  const currentUser = store.getCurrentUser();
  // Role Admin/teacher mới được quyền gạt công tắc
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'Admin' || currentUser?.role === 'teacher';

  useEffect(() => {
    // Nếu ứng dụng đang SSR hoặc không có mạng lúc khởi đầu, lấy local cache làm default mượt tránh flash UI
    const localVal = localStorage.getItem(`toggle_sync_${key}`);
    if (localVal !== null && !isReady) {
      setValue(JSON.parse(localVal));
    }

    // Kết nối real-time WebSocket với Firebase Firestore
    const unsubscribe = onSnapshot(doc(db, 'system_config', 'api_toggles'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data && typeof data[key] === 'boolean') {
          const remoteValue = data[key];
          setValue(remoteValue);
          setIsReady(true);
          
          // Phát sóng xuyên component / non-react context (Event Bus)
          localStorage.setItem(`toggle_sync_${key}`, JSON.stringify(remoteValue));
          window.dispatchEvent(new CustomEvent('persistent_toggle_changed', { 
            detail: { key, value: remoteValue } 
          }));
        }
      }
    }, (error) => {
      console.warn(`[Toggle] Lỗi đọc stream trên key ${key}, rớt về cục bộ`, error);
    });

    // Lắng nghe sự kiện intra-app ném ra từ tab khác hoặc ngoài flow luồng React (tuỳ chọn backup)
    const handleLocalSync = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail?.key === key) {
        setValue(customEvent.detail.value);
      }
    };
    window.addEventListener('persistent_toggle_changed', handleLocalSync);

    return () => {
      unsubscribe();
      window.removeEventListener('persistent_toggle_changed', handleLocalSync);
    };
  }, [key, isReady]);

  const toggle = useCallback(async () => {
    if (!isAdmin) {
      console.warn("Mày không phải Admin, cấm đụng vào!");
      return;
    }
    
    // UI Optimistic Update (Bật trước giật sau cho mượt)
    const newValue = !value;
    setValue(newValue);
    localStorage.setItem(`toggle_sync_${key}`, JSON.stringify(newValue));
    window.dispatchEvent(new CustomEvent('persistent_toggle_changed', { 
      detail: { key, value: newValue } 
    }));
    
    try {
      // Đẩy lên Backend Database để update toàn server
      await dbService.updateApiToggles({ [key]: newValue });
    } catch (e) {
      console.error("Lỗi khi update toggle lên server, revert", e);
      // Revert về cũ nếu rớt mạng / lỗi quyền
      setValue(!newValue);
      localStorage.setItem(`toggle_sync_${key}`, JSON.stringify(!newValue));
      window.dispatchEvent(new CustomEvent('persistent_toggle_changed', { 
        detail: { key, value: !newValue } 
      }));
    }
  }, [value, isAdmin, key]);

  return [value, toggle, isAdmin] as const;
}
