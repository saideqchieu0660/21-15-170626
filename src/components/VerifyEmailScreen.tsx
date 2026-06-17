import React, { useEffect } from 'react';
import { Mail, ArrowLeft } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';

export default function VerifyEmailScreen() {
  useEffect(() => {
    document.title = "Henosis Web";
  }, []);

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const email = searchParams.get('email') || 'your email';

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-orange-500/20 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-orange-500/20 blur-[120px]" />
      </div>

      <div className="w-full max-w-md glass p-8 sm:p-10 rounded-[12px] relative z-10 shadow-2xl border border-orange-600/30 dark:border-white/10 text-center animate-in slide-in-from-bottom-4 fade-in duration-500">
        <div className="w-16 h-16 bg-orange-500/20 border border-orange-500/30 rounded-full flex items-center justify-center mx-auto mb-6">
          <Mail className="w-8 h-8 text-orange-600 dark:text-orange-400" />
        </div>
        
        <h2 className="text-2xl font-display font-bold text-transparent bg-clip-text bg-gradient-to-r from-orange-700 via-orange-500 to-orange-600 dark:from-orange-200 dark:via-orange-400 dark:to-orange-500 mb-4">
          Xác minh tài khoản
        </h2>
        
        <p className="text-zinc-600 dark:text-zinc-300 mb-8 leading-relaxed">
          We have sent a verification email to <span className="font-bold text-orange-600 dark:text-orange-400">{email}</span>. Please verify your account, then return here to log in.
        </p>

        <button
          onClick={() => navigate('/')}
          className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white dark:text-black font-bold py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-orange-500/25"
        >
          <ArrowLeft className="w-5 h-5" />
          Login
        </button>
      </div>
    </div>
  );
}
