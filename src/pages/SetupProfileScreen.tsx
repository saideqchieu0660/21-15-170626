import React, { useState , useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { User, Key, Loader2, AlertCircle, ArrowRight, Eye, EyeOff, Lock, Bug, Camera } from 'lucide-react';
import { dbService } from '../lib/firebase';
import { store } from '../lib/store';
import { auth } from '../lib/firebase';
import { updatePassword, updateProfile } from 'firebase/auth';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { getEnvDiagnostics } from '../utils/envDiagnostics';

export default function SetupProfileScreen() {
  const [username, setUsername] = useState(() => {
    return auth.currentUser?.displayName || auth.currentUser?.email?.split('@')[0] || '';
  });
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [adminKey, setAdminKey] = useState('');
  const [showAdminKey, setShowAdminKey] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [photoUrl, setPhotoUrl] = useState(() => {
    return auth.currentUser?.photoURL || '';
  });
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "Henosis Web";
    if (auth.currentUser) {
      setUsername(auth.currentUser.displayName || auth.currentUser.email?.split('@')[0] || '');
      setPhotoUrl(auth.currentUser.photoURL || '');
    }
  }, []);

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsLoading(true);
      setError(null);
      
      const compressedBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          if (!event.target?.result) {
            return reject(new Error("Lỗi đọc file (trống)"));
          }
          const img = new Image();
          img.onload = () => {
            try {
              const canvas = document.createElement('canvas');
              const max_size = 96; // 96x96 pixels (extremely compact, under 4KB)
              let width = img.width;
              let height = img.height;

              // Crop square to avoid distortion
              const size = Math.min(width, height);
              const xOffset = (width - size) / 2;
              const yOffset = (height - size) / 2;

              canvas.width = max_size;
              canvas.height = max_size;

              const ctx = canvas.getContext('2d');
              if (ctx) {
                ctx.drawImage(img, xOffset, yOffset, size, size, 0, 0, max_size, max_size);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.65);
                resolve(dataUrl);
              } else {
                reject(new Error("Không thể khởi tạo canvas context"));
              }
            } catch (err) {
              reject(err);
            }
          };
          img.onerror = () => reject(new Error("Lỗi định dạng ảnh"));
          img.src = event.target.result as string;
        };
        reader.onerror = () => reject(new Error("Lỗi đọc IO file"));
        try {
          reader.readAsDataURL(file);
        } catch (e) {
          reject(e);
        }
      });
      
      const user = auth.currentUser;
      if (user) {
        const { storage } = await import('../lib/firebase');
        const fileRef = ref(storage, `avatars/${user.uid}_${Date.now()}.jpg`);
        await uploadString(fileRef, compressedBase64, 'data_url');
        const downloadUrl = await getDownloadURL(fileRef);
        if (!downloadUrl) throw new Error("Invalid asset URL returned");
        setPhotoUrl(downloadUrl);
      } else {
        setPhotoUrl(compressedBase64);
      }
    } catch (err: any) {
      console.error("Lỗi upload avatar:", err);
      setError("Không thể xử lý ảnh này. Vui lòng chọn ảnh khác.");
      if (auth.currentUser?.photoURL) {
        setPhotoUrl(auth.currentUser.photoURL);
      } else {
        setPhotoUrl("");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      setError("Vui lòng nhập tên hiển thị.");
      return;
    }
    if (!password || password.length < 6) {
      setError("Mật khẩu tài khoản phải gồm ít nhất 6 ký tự.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Không tìm thấy người dùng đăng nhập.");

      // Cập nhật profile và mật khẩu cho tài khoản Google hiện tại để đăng nhập bình thường sau này
      await updateProfile(user, { 
        displayName: username.trim(),
        photoURL: photoUrl || null
      });
      
      const email = user.email;
      if (email) {
        try {
          const { linkWithCredential, EmailAuthProvider } = await import('firebase/auth');
          const credential = EmailAuthProvider.credential(email, password);
          await linkWithCredential(user, credential);
        } catch (linkErr: any) {
          // Nếu đã được liên kết hoặc xảy ra lỗi khác, chúng ta cập nhật trực tiếp qua updatePassword làm fallback
          console.log("Linking fallback:", linkErr);
          await updatePassword(user, password);
        }
      } else {
        await updatePassword(user, password);
      }

      let role = "student";
      let isPro = false;
      let isTeacher = false;
      
      if (adminKey) {
          try {
              const verifyRes = await fetch('/api/auth/escalate-role', {
                 method: 'POST',
                 headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify({ uid: user.uid, providedKey: adminKey })
              }).then(res => res.json());

              if (verifyRes.success) {
                  if (verifyRes.role === "Admin") {
                      isTeacher = true;
                      role = "Admin";
                  }
                  if (verifyRes.isPro) isPro = true;
              }
          } catch(e) {}
      }

      await dbService.updateUserProfile(user.uid, {
        name: username.trim(),
        role: role,
        email: user.email || "",
        isPro: isPro,
        isSchoolLover: isPro,
        photoURL: photoUrl || ""
      });

      const profile = await dbService.getUserProfile(user.uid);
      const currentUser = store.getCurrentUser();
      if (currentUser) {
          currentUser.role = role as any;
          currentUser.name = username.trim();
          currentUser.isPro = isPro;
          currentUser.isSchoolLover = isPro;
          (currentUser as any).photoURL = photoUrl || "";
      }

      const isTeacherRole = role === 'Admin';
      navigate(isTeacherRole ? '/teacher' : '/dashboard');
    } catch (err: any) {
      setError(err.message || "Đã xảy ra lỗi khi thiết lập hồ sơ.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md glass p-8 rounded-[12px] shadow-2xl border border-orange-600/30">
        <h2 className="text-2xl font-bold text-center mb-1 text-zinc-800 dark:text-zinc-100 font-display">Thiết lập hồ sơ</h2>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 text-center mb-5 italic">
          Cài đặt thông tin tài khoản Google của bạn để có thể sử dụng song song cả hình thức đăng nhập thông thường bằng Gmail và Password.
        </p>
        
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 p-3 rounded-lg flex items-start gap-2 text-sm mb-4">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSetup} className="space-y-4">
          {/* Avatar picker */}
          <div className="flex flex-col items-center justify-center pb-4 space-y-2 border-b border-orange-500/10 mb-4 select-none">
            <div 
              className="relative group cursor-pointer" 
              onClick={() => fileInputRef.current?.click()}
              title="Nhấn để chọn ảnh hoặc chụp ảnh đại diện"
            >
              <div className="w-20 h-20 rounded-full border-2 border-orange-500 overflow-hidden bg-zinc-100 dark:bg-zinc-850 flex items-center justify-center transition-all group-hover:opacity-85 shadow-md">
                {photoUrl ? (
                  <img src={photoUrl} alt="Avatar profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <User className="w-10 h-10 text-zinc-400 dark:text-zinc-500" />
                )}
              </div>
              <div className="absolute bottom-0 right-0 bg-orange-500 text-white rounded-full p-1.5 shadow-md border border-white dark:border-zinc-900 group-hover:scale-110 transition-transform">
                <Camera className="w-3.5 h-3.5" />
              </div>
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-xs text-orange-600 dark:text-orange-400 font-extrabold hover:underline flex items-center gap-1"
            >
              📸 Tải ảnh hoặc Chụp trực tiếp
            </button>
            <span className="text-[9px] text-zinc-400 dark:text-zinc-500 text-center select-none block leading-tight max-w-[280px]">
              Ảnh tải lên sẽ được nén và tự động trích xuất dưới dạng URL để tối ưu hóa hiệu suất cơ sở dữ liệu!
            </span>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handlePhotoChange}
              accept="image/*"
              className="hidden"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold uppercase tracking-widest pl-1 flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400">
              <User className="w-3.5 h-3.5" /> Tên hiển thị
            </label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 bg-white/50 dark:bg-black/30 border border-orange-500/30 rounded-lg text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-orange-500"
              placeholder="Tên của bạn"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold uppercase tracking-widest pl-1 flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400">
              <Lock className="w-3.5 h-3.5" /> Mật khẩu tài khoản
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-white/50 dark:bg-black/30 border border-orange-500/30 rounded-lg pr-10 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-orange-500"
                placeholder="Đặt mật khẩu bảo mật"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 opacity-50 hover:opacity-100 transition-opacity"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold uppercase tracking-widest pl-1 flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400">
              <Key className="w-3.5 h-3.5" /> Mã phân quyền (không bắt buộc)
            </label>
            <div className="relative">
                <input
                    type="text"
                    name="custom_role_key"
                    autoComplete="off"
                    style={{ WebkitTextSecurity: showAdminKey ? 'none' : 'disc' } as React.CSSProperties}
                    value={adminKey}
                    onChange={(e) => setAdminKey(e.target.value)}
                    className="w-full px-4 py-3 bg-white/50 dark:bg-black/30 border border-orange-500/30 rounded-lg pr-10 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-orange-500"
                    placeholder="Mã phân quyền"
                />
                <button
                    type="button"
                    onClick={() => setShowAdminKey(!showAdminKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 opacity-50 hover:opacity-100 transition-opacity"
                 >
                    {showAdminKey ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 hover:opacity-95 transition-opacity disabled:opacity-50"
          >
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Hoàn tất <ArrowRight className="w-5 h-5" /></>}
          </button>
        </form>

        <div className="mt-8 flex justify-end">
           <button 
             type="button"
             onClick={() => setShowDebug(!showDebug)}
             className="opacity-10 hover:opacity-100 transition-opacity p-2 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-800"
             title="Toggle Debug View"
           >
             <Bug className="w-4 h-4 text-zinc-500" />
           </button>
        </div>

        {showDebug && (
          <div className="mt-4 p-4 text-xs font-mono bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg overflow-x-auto">
            <h4 className="font-bold mb-2 uppercase tracking-widest opacity-60">Environment Diagnostics</h4>
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="opacity-60 border-b border-black/10 dark:border-white/10">
                  <th className="pb-2">Variable</th>
                  <th className="pb-2">Exists</th>
                  <th className="pb-2">Value Preview</th>
                </tr>
              </thead>
              <tbody className="opacity-80">
                {Object.entries(getEnvDiagnostics()).map(([key, data]) => (
                  <tr key={key} className="border-b border-black/5 dark:border-white/5 last:border-0">
                    <td className="py-2 pr-4">{key}</td>
                    <td className="py-2 pr-4 text-center">
                      {data.exists ? <span className="text-green-500 dark:text-green-400">Yes</span> : <span className="text-red-500 dark:text-red-400">No</span>}
                    </td>
                    <td className="py-2">{data.preview} <span className="opacity-50">({data.length} chars)</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
