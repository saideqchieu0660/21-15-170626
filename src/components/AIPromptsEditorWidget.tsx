import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Bot, Save, Loader2, Sparkles, AlertCircle } from 'lucide-react';
import { getAuth } from "firebase/auth";
import { syncAIPrompts } from '../utils/apiClient';

export function AIPromptsEditorWidget() {
  const [prompts, setPrompts] = useState<any>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchPrompts = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/ai-prompts?t=${Date.now()}`);
      const data = await res.json();
      if (data && data.success) {
        setPrompts(data.data || {});
      }
    } catch (err: any) {
      setError(err.message || "Failed to load prompts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrompts();
  }, []);

  const handleChange = (key: string, value: string) => {
    setPrompts((prev: any) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const auth = getAuth();
      const user = auth.currentUser;
      const idToken = user ? await user.getIdToken() : "";
      const adminKey = localStorage.getItem("henosis_admin_key") || "";

      const res = await fetch("/api/admin/ai-prompts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": idToken ? `Bearer ${idToken}` : "",
          "x-admin-key": adminKey
        },
        body: JSON.stringify(prompts)
      });
      const data = await res.json();
      if (data.success) {
        setSuccess("Lưu System Prompts thành công! Server đã cập nhật đồng bộ.");
        syncAIPrompts();
        setTimeout(() => setSuccess(null), 3000);
      } else {
        throw new Error(data.error || "Save failed");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-white/50 text-sm flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin"/> Đang tải Prompt Config...</div>;

  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5 mb-8">
      <div className="flex items-center gap-3 mb-4 border-b border-white/10 pb-3">
        <div className="bg-gradient-to-br from-indigo-500 to-purple-500 w-10 h-10 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
          <Bot className="w-5 h-5 text-indigo-50" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            AI Prompts Configuration <Sparkles className="w-4 h-4 text-amber-400" />
          </h2>
          <p className="text-xs text-white/50">Đồng bộ hoá toàn cầu (Global Server Override)</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-sm flex items-start gap-2 mb-4">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {success && (
         <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 text-green-400 text-sm flex items-start gap-2 mb-4">
          <Sparkles className="w-4 h-4 mt-0.5 shrink-0" />
          <p>{success}</p>
        </div>
      )}

      <div className="space-y-6">
        {/* Agent 2 configs */}
        <div className="space-y-4">
          <h3 className="text-indigo-400 font-semibold px-2 border-l-2 border-indigo-400">Agent 2 (Giảng viên / Giải nghĩa)</h3>
          
          <div className="bg-slate-900/50 rounded-lg p-4 border border-white/5 relative group">
            <label className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-2 block">Agent 2 System Core</label>
            <textarea
              className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-sm text-amber-100 font-mono h-24 focus:outline-none focus:border-indigo-500 transition-colors"
              placeholder="You are a professional educational coach..."
              value={prompts.agent2_system || "You are a professional educational coach. Answer immediately using clean Vietnamese Markdown without conversational introductions."}
              onChange={(e) => handleChange('agent2_system', e.target.value)}
            />
          </div>

          <div className="bg-slate-900/50 rounded-lg p-4 border border-white/5 relative group">
            <label className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-2 block">Agent 2 Câu lệnh giải thích (Fast Mode)</label>
            <p className="text-[10px] text-white/40 mb-2">Biến nội suy: {`{term}`} và {`{definition}`}</p>
            <textarea
              className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-sm text-sky-100 font-mono h-40 focus:outline-none focus:border-indigo-500 transition-colors"
              placeholder="Giải nghĩa khái niệm {term}..."
              value={prompts.agent2_fast || `Giải nghĩa khái niệm "{term}" (Định nghĩa của người dùng: {definition}).\nYÊU CẦU QUAN TRỌNG NHẤT:\n1. ĐI THẲNG VÀO NỘI DUNG, BỎ QUA MỌI LỜI CHÀO HỎI xã giao hay câu mào đầu.\n2. Dài khoảng tối thiểu 250 chữ, giải thích bản chất súc tích nhưng đầy đủ sinh động, trực quan.\n3. BẮT BUỘC có cấu trúc:\n- Bản chất cốt lõi (1 câu cực gọn).\n- Đi sâu vào chi tiết giải thích bản chất thực sự của khái niệm.\n- 1 Ví dụ minh hoạ thực tế sinh động.\n- NẾU LÀ TIẾNG ANH: Bắt buộc cung cấp loại từ và giải thích cặn kẽ nguồn gốc (etymology) của từ để người học dễ nhớ hơn.\n- Kết bằng câu hỏi gợi mở suy luận.\nChỉ trả ra nội dung (markdown).`}
              onChange={(e) => handleChange('agent2_fast', e.target.value)}
            />
          </div>

          <div className="bg-slate-900/50 rounded-lg p-4 border border-white/5 relative group">
            <label className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-2 block">Agent 2 Câu lệnh Phân tích sâu (Detailed Mode)</label>
            <p className="text-[10px] text-white/40 mb-2">Biến nội suy: {`{term}`} và {`{definition}`}</p>
            <textarea
              className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-sm text-sky-100 font-mono h-40 focus:outline-none focus:border-indigo-500 transition-colors"
              placeholder="Phân tích khái niệm {term}..."
              value={prompts.agent2_detailed || `Phân tích khái niệm "{term}" (Định nghĩa: {definition}).\nYÊU CẦU QUAN TRỌNG NHẤT:\n1. ĐI THẲNG VÀO NỘI DUNG, BỎ QUA MỌI LỜI CHÀO HỎI xã giao hay câu mào đầu.\n2. Dài khoảng tối thiểu 250 chữ, giải thích bản chất cốt lõi cực kỳ chi tiết, dễ hiểu.\n3. BẮT BUỘC CÁC BƯỚC:\n- Định nghĩa & Bản chất cốt lõi.\n- NẾU LÀ TIẾNG ANH: Bắt buộc cung cấp loại từ và giải thích cặn kẽ nguồn gốc (etymology) của từ để người học có thể nhớ sâu hơn.\n- Mở rộng vấn đề và góc nhìn phân tích.\n- BẮT BUỘC kết thúc bằng 1 câu hỏi gợi mở liên quan đến ứng dụng hoặc tính chất cốt lõi để thúc đẩy học sinh tự suy nghĩ và phát triển kiến thức.\nBọc công thức Toán/Lý/Hóa bằng LaTeX (dấu $ hoặc $$). Chỉ trả ra nội dung (markdown).`}
              onChange={(e) => handleChange('agent2_detailed', e.target.value)}
            />
          </div>
        </div>

        {/* Agent 3 configs */}
        <div className="space-y-4 pt-6 border-t border-white/10">
          <h3 className="text-amber-400 font-semibold px-2 border-l-2 border-amber-400">Agent 3 (Bot Trò Chuyện 2 Tầng)</h3>
          
          <div className="bg-slate-900/50 rounded-lg p-4 border border-white/5 relative group">
            <label className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-2 block">Agent 3 System Core (Tầng 1 - Routing / Phân Vạch)</label>
            <p className="text-[10px] text-white/40 mb-2">Prompt định tuyến, dùng để phân loại ý định người dùng ra các chế độ.</p>
            <textarea
              className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-sm text-emerald-100 font-mono h-40 focus:outline-none focus:border-amber-500 transition-colors"
              placeholder="Mày là Agent 3 Router..."
              value={prompts.agent3_tier1 || `Mày là Agent 3 Tier 1 Router. Phân tích ngữ cảnh và trả về đúng 1 từ khóa: direct, debate, hoặc socrates.`}
              onChange={(e) => handleChange('agent3_tier1', e.target.value)}
            />
          </div>

          <div className="bg-slate-900/50 rounded-lg p-4 border border-white/5 relative group">
            <label className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-2 block">Agent 3 System Core (Direct Mode)</label>
            <p className="text-[10px] text-white/40 mb-2">Biến nội suy: {`{englishRule}`} và {`{styleGuidance}`}</p>
            <textarea
              className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-sm text-emerald-100 font-mono h-40 focus:outline-none focus:border-amber-500 transition-colors"
              placeholder="Mày là trợ lý AI..."
              value={prompts.agent3_direct || `Mày là trợ lý AI tên Agent 3 (Direct Robot Mode).\nĐIỀU KHOẢN TỐI THƯỢNG:\n1. XƯNG HÔ "MÀY/TAO": Bắt buộc xưng "tao" và gọi người dùng là "mày". CẤM DÙNG TỪ "bạn", "tôi", "mình", "anh/chị".\n2. TRẢ LỜI TRỰC TIẾP: KHÔNG áp dụng Socratic. KHÔNG hỏi ngược lại người dùng. Đưa trực tiếp câu trả lời ra.\n3. KHÔNG BẮT CHƯỚC LỊCH SỬ NẾU SAI CHẾ ĐỘ. Tự chỉnh lại độ dài/văn phong ngay lập tức.\n4. FORMAT: Dùng LaTeX ($$, $).{englishRule}\n{styleGuidance}`}
              onChange={(e) => handleChange('agent3_direct', e.target.value)}
            />
          </div>

          <div className="bg-slate-900/50 rounded-lg p-4 border border-white/5 relative group">
            <label className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-2 block">Agent 3 System Core (Debate Mode)</label>
            <p className="text-[10px] text-white/40 mb-2">Biến nội suy: {`{englishRule}`} và {`{styleGuidance}`}</p>
            <textarea
              className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-sm text-emerald-100 font-mono h-40 focus:outline-none focus:border-amber-500 transition-colors"
              placeholder="Mày là trợ lý AI..."
              value={prompts.agent3_debate || `Mày là trợ lý AI tên Agent 3 (Devil's Advocate / Tranh biện Mode).\nĐIỀU KHOẢN TỐI THƯỢNG:\n1. XƯNG HÔ "MÀY/TAO": Bắt buộc xưng "tao" và gọi người dùng là "mày".\n2. ĐÓNG VAI ĐỐI THỦ TRANH LUẬN: Luôn đóng vai phản biện gắt gao. Cấm xuôi theo ý người dùng. Cố tình vạch trần sơ hở tư duy.\n3. BUỘC NGƯỜI DÙNG PHÒNG THỦ: Luôn kết thúc bằng một câu hỏi xoáy, thách thức lập trường hiện tại của người dùng.\n4. FORMAT: Dùng LaTeX ($$, $).{englishRule}\n{styleGuidance}`}
              onChange={(e) => handleChange('agent3_debate', e.target.value)}
            />
          </div>

          <div className="bg-slate-900/50 rounded-lg p-4 border border-white/5 relative group">
            <label className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-2 block">Agent 3 System Core (Socratic Mode)</label>
            <p className="text-[10px] text-white/40 mb-2">Biến nội suy: {`{socraticRule}`}, {`{englishRule}`} và {`{styleGuidance}`}</p>
            <textarea
              className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-sm text-emerald-100 font-mono h-40 focus:outline-none focus:border-amber-500 transition-colors"
              placeholder="Mày là Agent 3 - Socrates AI Coach..."
              value={prompts.agent3_socrates || `Mày là Agent 3 - Socrates AI Coach.\nQUY TẮC CỐT LÕI:\n1. XƯNG HÔ "MÀY/TAO": Bắt buộc xưng "tao" và gọi người dùng là "mày". Cấm dùng "bạn", "tôi", "mình".\n{socraticRule}\n3. CẤM BẮT CHƯỚC ĐỘ DÀI LỊCH SỬ NẾU HIỆN TẠI YÊU CẦU ĐỘ DÀI KHÁC. Phải tuân theo yêu cầu hiện tại.\n4. FORMAT: Dùng LaTeX.{englishRule}\n{styleGuidance}`}
              onChange={(e) => handleChange('agent3_socrates', e.target.value)}
            />
          </div>

          <div className="bg-slate-900/50 rounded-lg p-4 border border-white/5 relative group">
            <label className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-2 block">Agent 3 Độ phân giải (Siêu Chi Tiết)</label>
            <p className="text-[10px] text-white/40 mb-2">Được chèn vào biến {`{styleGuidance}`}</p>
            <textarea
              className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-sm text-emerald-100 font-mono h-40 focus:outline-none focus:border-amber-500 transition-colors"
              placeholder="\nĐỘ CHI TIẾT - SIÊU CHI TIẾT (SUPER DETAILED MODE)..."
              value={prompts.agent3_length_super_detailed || `\nĐỘ CHI TIẾT - SIÊU CHI TIẾT (SUPER DETAILED MODE):\n- BẮT BUỘC TỐI CAO: Tập trung phân tích chuyên sâu toàn bộ bản chất khoa học và nguồn gốc vấn đề từ cốt lõi. Phân chia nhỏ các khía cạnh bằng các đề mục lớn.\n- BẮT BUỘC TỐI CAO: Trả lời cực kỳ dài dặn, đầy đủ chi tiết, dồi dào chữ nghĩa, cặn kẽ và phong phú (tối thiểu bắt buộc 600 từ). Tuyệt đối cấm trả lời sơ sài hoặc ngắn gọn!\n- Cung cấp ít nhất 3 ví dụ minh họa thực tế sinh động. Cắt nghĩa cặn kẽ từng thứ.\n- Tuyệt đối bỏ qua hoàn toàn mọi yêu cầu viết ngắn gọn.`}
              onChange={(e) => handleChange('agent3_length_super_detailed', e.target.value)}
            />
          </div>

          <div className="bg-slate-900/50 rounded-lg p-4 border border-white/5 relative group">
            <label className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-2 block">Agent 3 Độ phân giải (Chi Tiết)</label>
            <p className="text-[10px] text-white/40 mb-2">Được chèn vào biến {`{styleGuidance}`}</p>
            <textarea
              className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-sm text-emerald-100 font-mono h-32 focus:outline-none focus:border-amber-500 transition-colors"
              placeholder="\nĐỘ CHI TIẾT - CHI TIẾT (DETAILED MODE)..."
              value={prompts.agent3_length_detailed || `\nĐỘ CHI TIẾT - CHI TIẾT (DETAILED MODE):\n- Tập trung vào bản chất cốt lõi. Trả lời chi tiết ở mức độ vừa đủ trọn vẹn.\n- Dài khoảng 250 - 400 chữ.\n- Bắt buộc có 1 - 2 ví dụ cụ thể để làm rõ nghĩa.\n- Không được quá siêu ngắn gọn, nhưng cũng đừng lê thê lan man, giữ độ dài lý tưởng.`}
              onChange={(e) => handleChange('agent3_length_detailed', e.target.value)}
            />
          </div>

          <div className="bg-slate-900/50 rounded-lg p-4 border border-white/5 relative group">
            <label className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-2 block">Agent 3 Độ phân giải (Súc Tích)</label>
            <p className="text-[10px] text-white/40 mb-2">Được chèn vào biến {`{styleGuidance}`}</p>
            <textarea
              className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-sm text-emerald-100 font-mono h-24 focus:outline-none focus:border-amber-500 transition-colors"
              placeholder="\nĐỘ CHI TIẾT - SÚC TÍCH (CONCISE MODE)..."
              value={prompts.agent3_length_concise || `\nĐỘ CHI TIẾT - SÚC TÍCH (CONCISE MODE):\n- Trả lời cực kỳ ngắn gọn, tối giản (chỉ 1-3 câu).\n- Đi thẳng vào bản chất cốt lõi, không giải thích dông dài phụ họa.`}
              onChange={(e) => handleChange('agent3_length_concise', e.target.value)}
            />
          </div>

          <div className="bg-slate-900/50 rounded-lg p-4 border border-white/5 relative group">
            <label className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-2 block">Agent 3 Lời nhắc độ dài (Prompt Injection)</label>
            <p className="text-[10px] text-white/40 mb-2">Được chèn sát với input của user khi dùng chi tiết hoặc siêu chi tiết.</p>
            <textarea
              className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-sm text-emerald-100 font-mono h-20 focus:outline-none focus:border-amber-500 transition-colors"
              placeholder="[LỜI NHẮC LÕI]..."
              value={prompts.agent3_length_reminder || `[LỜI NHẮC LÕI]: MÀY ĐANG Ở CHẾ ĐỘ CHI TIẾT. HÃY PHỚT LỜ LỊCH SỬ NGẮN GỌN TRƯỚC ĐÓ! BẮT BUỘC PHẢI GIẢI THÍCH DÀI DẰNG DẶC.`}
              onChange={(e) => handleChange('agent3_length_reminder', e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-900/50 rounded-lg p-4 border border-white/5 relative group">
              <label className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-2 block">Socratic Rule (Detailed Modal)</label>
              <textarea
                className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-xs text-emerald-100 font-mono h-28 focus:outline-none focus:border-amber-500 transition-colors"
                value={prompts.agent3_socratic_long_rule || `2. PHƯƠNG PHÁP SOCRATIC: BẮT BUỘC PHẢI THỰC HIỆN ĐẦY ĐỦ số lượng chữ đã yêu cầu trước (dài dặn cặn kẽ), CẤM TRẢ LỜI NGẮN. Sau khi giải thích xong theo đúng chuẩn chiều dài, chỉ đặt MỘT VÀ CHỈ MỘT câu hỏi gợi mở ở TẬN CÙNG để thúc đẩy tự suy nghĩ.`}
                onChange={(e) => handleChange('agent3_socratic_long_rule', e.target.value)}
              />
            </div>
            <div className="bg-slate-900/50 rounded-lg p-4 border border-white/5 relative group">
              <label className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-2 block">Socratic Rule (Concise Modal)</label>
              <textarea
                className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-xs text-emerald-100 font-mono h-28 focus:outline-none focus:border-amber-500 transition-colors"
                value={prompts.agent3_socratic_short_rule || `2. PHƯƠNG PHÁP SOCRATIC: Không bao giờ cho đáp án dễ dàng. Luôn dồn ép bằng câu hỏi gợi mở suy luận.`}
                onChange={(e) => handleChange('agent3_socratic_short_rule', e.target.value)}
              />
            </div>
          </div>

          <div className="bg-slate-900/50 rounded-lg p-4 border border-white/5 relative group">
            <label className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-2 block">Agent 3 Đặc quyền Tiếng Anh (English Rule)</label>
            <p className="text-[10px] text-white/40 mb-2">Được chèn vào {`{englishRule}`}</p>
            <textarea
              className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-sm text-emerald-100 font-mono h-24 focus:outline-none focus:border-amber-500 transition-colors"
              placeholder="\nĐẶC QUYỀN VỀ TIẾNG ANH..."
              value={prompts.agent3_english_rule || `\nĐẶC QUYỀN VỀ TIẾNG ANH & GIAO TIẾP: Đi thẳng vào nội dung, bỏ qua mọi lời chào hỏi xã giao. Nếu câu hỏi liên quan đến tiếng Anh (từ vựng, thuật ngữ...), BẮT BUỘC cung cấp loại từ (part of speech) và giải thích nguồn gốc của nó (etymology) để giúp người học dễ nhớ hơn.`}
              onChange={(e) => handleChange('agent3_english_rule', e.target.value)}
            />
          </div>
        </div>

        {/* United Engine configs */}
        <div className="space-y-4 pt-6 border-t border-white/10">
          <h3 className="text-red-400 font-semibold px-2 border-l-2 border-red-400">United Engine (Data Compiler)</h3>
          
          <div className="bg-slate-900/50 rounded-lg p-4 border border-white/5 relative group">
            <label className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-2 block">Document Chunk Ingestion (Normal Mode)</label>
            <p className="text-[10px] text-white/40 mb-2">Biến nội suy: {`{targetMin}`}, {`{targetMax}`} và {`{textChunk}`}</p>
            <textarea
              className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-sm text-pink-100 font-mono h-40 focus:outline-none focus:border-red-500 transition-colors"
              placeholder="You are an elite English-Vietnamese lexicographer..."
              value={prompts.united_process_chunk_normal || `You are an elite English-Vietnamese lexicographer and academic vocabulary trainer. Your goal is to identify and extract prominent vocabulary words, academic terms, useful collocations, or idiomatic expressions from this source text into highly educational flashcards.
 
Each flashcard object MUST have:
- front: English word/phrase.
- ipa: Accurate IPA pronunciation.
- wordForm: noun|verb|adjective|adverb|phrasal verb|idiom.
- back: Concise Vietnamese translation.
- example: Illustrative English sentence with its Vietnamese translation in parentheses immediately following.
- origin: The matching raw word, phrase or context from the original text chunk.
 
STRICT CARD COUNT COHERENCE & LIMITS:
- You MUST extract between {targetMin} and {targetMax} highly valuable vocabulary terms or phrases from the provided source text.
- Do NOT generate fewer than {targetMin} or more than {targetMax} cards under any circumstances to keep output sizes deterministic and protect API bandwidth.
 
SMART VOCABULARY YIELD & ACADEMIC BALANCE:
1. RELAXED ACADEMIC FILTERING: Focus on selecting prominent nouns, verbs, adjectives, and adverbs that have educational or lexical value from the source text. Look for ANY core vocabulary words, useful academic collocations, or idiomatic expressions that would be beneficial for a student to study.
2. MINIMUM YIELD GUARDRAIL: Analyze the provided text packet thoroughly. If the text contains readable English sentences or word lists, you MUST extract at least {targetMin} useful vocabulary terms from it. Do not return an empty array [] unless the input string is completely devoid of English words.
3. CRITICAL LINGUISTIC HYGIENE: While we want high selection yield, you are strictly FORBIDDEN from extracting pure machine or layout strings, such as standalone bracket tokens, single-character noise, or raw PDF/programming syntax markers (like "obj", "endobj", "stream", "endstream", "xref", "trailer", "startxref").
4. STRICT CONTEXTUAL VERIFICATION: Avoid technical parameters, variable namespace tokens, or system property names being used as coding variables in the source text. Focus on genuine words used in human communication.
 
Rule Checklist:
1. Return ONLY a valid minified JSON array [].
2. No markdown wrapper.
3. Maintain maximum yield of legitimate advanced and useful vocabularies.
 
Original Source Text:
{textChunk}`}
              onChange={(e) => handleChange('united_process_chunk_normal', e.target.value)}
            />
          </div>

          <div className="bg-slate-900/50 rounded-lg p-4 border border-white/5 relative group">
            <label className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-2 block">Document Chunk Ingestion (Degraded Mode)</label>
            <p className="text-[10px] text-white/40 mb-2">Biến nội suy: {`{targetMin}`}, {`{targetMax}`} và {`{textChunk}`}</p>
            <textarea
              className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-sm text-pink-100 font-mono h-40 focus:outline-none focus:border-red-500 transition-colors"
              placeholder="You are an elite English-Vietnamese lexicographer..."
              value={prompts.united_process_chunk_degraded || `You are an elite English-Vietnamese lexicographer and academic vocabulary trainer. Your goal is to identify and extract prominent vocabulary words, academic terms, useful collocations, or idiomatic expressions from this source text into highly educational flashcards.
 
Each flashcard object MUST have ONLY these critical fields:
- front: English word/phrase.
- ipa: Accurate IPA pronunciation.
- wordForm: noun|verb|adjective|adverb|phrasal verb|idiom.
- back: Concise Vietnamese translation.
 
(IMPORTANT: Drop the heavy fields like 'example' and 'origin' entirely to prevent computation timeout. Do not include 'example' or 'origin' in the JSON return structure. Return ONLY fields: front, ipa, wordForm, back).
 
STRICT CARD COUNT COHERENCE & LIMITS:
- You MUST extract between {targetMin} and {targetMax} highly valuable vocabulary terms or phrases from the provided source text.
- Do NOT generate fewer than {targetMin} or more than {targetMax} cards under any circumstances to keep output sizes deterministic and protect API bandwidth.
 
SMART VOCABULARY YIELD & ACADEMIC BALANCE:
1. RELAXED ACADEMIC FILTERING: Focus on selecting prominent nouns, verbs, adjectives, and adverbs that have educational or lexical value from the source text. Look for ANY core vocabulary words, useful academic collocations, or idiomatic expressions that would be beneficial for a student to study.
2. MINIMUM YIELD GUARDRAIL: Analyze the provided text packet thoroughly. If the text contains readable English sentences or word lists, you MUST extract at least {targetMin} useful vocabulary terms from it. Do not return an empty array [] unless the input string is completely devoid of English words.
3. CRITICAL LINGUISTIC HYGIENE: While we want high selection yield, you are strictly FORBIDDEN from extracting pure machine or layout strings, such as standalone bracket tokens, single-character noise, or raw PDF/programming syntax markers (like "obj", "endobj", "stream", "endstream", "xref", "trailer", "startxref").
4. STRICT CONTEXTUAL VERIFICATION: Avoid technical parameters, variable namespace tokens, or system property names being used as coding variables in the source text. Focus on genuine words used in human communication.
 
Rule Checklist:
1. Return ONLY a valid minified JSON array [].
2. No markdown wrapper.
3. Maintain maximum yield of legitimate advanced and useful vocabularies.
 
Original Source Text:
{textChunk}`}
              onChange={(e) => handleChange('united_process_chunk_degraded', e.target.value)}
            />
          </div>

          <div className="bg-slate-900/50 rounded-lg p-4 border border-white/5 relative group">
            <label className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-2 block">Extract Valid Words from Raw Text Chunk (fallback)</label>
            <p className="text-[10px] text-white/40 mb-2">Biến nội suy: {`{chunkWords}`}</p>
            <textarea
              className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-sm text-pink-100 font-mono h-40 focus:outline-none focus:border-red-500 transition-colors"
              placeholder="[STRICT DETERMINISTIC MODE] Bạn là một cỗ máy biên dịch..."
              value={prompts.united_convert_document_chunk || `[STRICT DETERMINISTIC MODE] Bạn là một cỗ máy biên dịch dữ liệu (Data Compiler).
Hãy trích xuất và tối ưu hoá Flashcard từ cụm dữ liệu thô dưới đây. Cụm dữ liệu này có thể chứa từ vựng tiếng Anh, định nghĩa, ví dụ, hoặc một số rác (headers/footers/số trang). Hãy nhặt ra các từ vựng tiếng Anh thực sự và tạo bộ Flashcards. Bỏ qua các rác không phải từ vựng.
 
BẮT BUỘC ĐỊNH DẠNG JSON MẢNG TƯƠNG THÍCH HOÀN TOÀN NHƯ SAU:
[
  {
    "front": "Từ khóa / Cụm từ tiếng Anh",
    "wordForm": "danh từ / động từ / tính từ / trạng từ / idiom / collocation",
    "back": "Phiên âm IPA - Nghĩa tiếng Việt ngắn gọn - Ví dụ cụ thể (nếu có)"
  }
]
- Tách riêng Từ loại (Word Form) CHÍNH XÁC.
- TRẢ VỀ ĐÚNG MỘT MẢNG JSON, KHÔNG CÓ MARKDOWN CODE BLOCK (\`\`\`json). KHÔNG GIẢI THÍCH GÌ THÊM.
- Trả về CHÍNH XÁC CÁC TỪ VỰNG HOẶC FLASHCARDS CÓ Ý NGHĨA. Nếu không có từ nào hợp lý, trả về mảng rỗng [].
 
CỤM DỮ LIỆU THÔ CẦN XỬ LÝ:
{chunkWords}`}
              onChange={(e) => handleChange('united_convert_document_chunk', e.target.value)}
            />
          </div>

          <div className="bg-slate-900/50 rounded-lg p-4 border border-white/5 relative group">
            <label className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-2 block">Card Hydration (Tìm ví dụ/ngữ cảnh)</label>
            <p className="text-[10px] text-white/40 mb-2">Biến nội suy: {`{front}`}, {`{wordForm}`} và {`{back}`}</p>
            <textarea
              className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-sm text-pink-100 font-mono h-40 focus:outline-none focus:border-red-500 transition-colors"
              placeholder="You are an expert English-Vietnamese lexicographer..."
              value={prompts.united_hydrate_card || `You are an expert English-Vietnamese lexicographer. Provide a high-quality illustrative example sentence for this English word/phrase.
          
Word: {front}
Part of Speech: {wordForm}
Meaning: {back}
 
Return ONLY a minified JSON object with these EXACT keys:
{
  "example": "Illustrative English sentence with its Vietnamese translation in parentheses immediately following.",
  "origin": "An appropriate context snippet matching the word."
}
 
Do not include any markdown wrapper or extra text.`}
              onChange={(e) => handleChange('united_hydrate_card', e.target.value)}
            />
          </div>

          <div className="bg-slate-900/50 rounded-lg p-4 border border-white/5 relative group">
            <label className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-2 block">JSON Validator & Repairer</label>
            <p className="text-[10px] text-white/40 mb-2">Biến nội suy: {`{jsonText}`}</p>
            <textarea
              className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-sm text-pink-100 font-mono h-40 focus:outline-none focus:border-red-500 transition-colors"
              placeholder="Bạn là một AI chuyên gia kiểm duyệt..."
              value={prompts.united_validate_json || `Bạn là một AI chuyên gia kiểm duyệt, làm sạch và sửa lỗi cú pháp dữ liệu cấu trúc (JSON Validator & Repairer).
Nhiệm vụ của bạn là nhận vào một chuỗi văn bản (gồm JSON chuẩn, hoặc JSON bị thiếu ngoặc, thừa dấu phẩy, bị bọc trong markdown) và sửa lỗi cú pháp, sau đó chuẩn hóa thành một mảng JSON Array chính xác:
 
[
  {
    "front": "Từ khóa / thuật ngữ / câu hỏi tiếng Anh",
    "wordForm": "từ loại (noun/verb/adj/adv...) nếu có, nếu không thì ghi rỗng",
    "ipa": "phiên âm IPA nếu có",
    "back": "Nghĩa tiếng Việt ngắn gọn, súc tích",
    "example": "ví dụ thực tế nếu có"
  }
]
 
Yêu cầu cực kỳ nghiêm ngặt:
- Trả về CHỈ mảng JSON Array sạch (bắt đầu bằng [ và kết thúc bằng ]).
- TUYỆT ĐỐI không bọc trong markdown \`\`\`json ... \`\`\`.
- KHÔNG có bất kỳ lời giải thích dông dài nào. Nếu không hợp lệ, trả về mảng rỗng [].
 
Dữ liệu đầu vào cần sửa lỗi:
{jsonText}`}
              onChange={(e) => handleChange('united_validate_json', e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="mt-8 pt-6 border-t border-white/10 flex justify-end">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg shadow-xl shadow-blue-900/20"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Lưu Chỉnh Sửa & Đồng Bộ
        </motion.button>
      </div>
    </div>
  );
}
