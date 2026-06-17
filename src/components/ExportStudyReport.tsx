import React, { useState } from "react";
import { 
  FileDown, 
  Printer, 
  Copy, 
  Check, 
  BookOpen, 
  Flame, 
  Trophy, 
  AlertTriangle, 
  CheckCircle2, 
  BrainCircuit, 
  Sparkles,
  ArrowRight,
  Info
} from "lucide-react";
import { Deck, User } from "../lib/store";

interface ExportStudyReportProps {
  user: User | null;
  decks: Deck[];
  studyHours: number;
  studyMinutes: number;
  dailyGoal: number;
  dailyReviewed: number;
}

export const ExportStudyReport: React.FC<ExportStudyReportProps> = ({
  user,
  decks,
  studyHours,
  studyMinutes,
  dailyGoal,
  dailyReviewed
}) => {
  const [showModal, setShowModal] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [reportType, setReportType] = useState<"standard" | "weak_only">("standard");

  // Calculate high-level student stats
  const totalDecks = decks.length;
  const totalCards = decks.reduce((sum, d) => sum + (d.cards?.length || 0), 0);
  
  const allCards = decks.flatMap(d => (d.cards || []).map(c => ({
    ...c,
    deckTitle: d.title,
    deckId: d.id
  })));

  // Calculate overall mastery
  const avgMastery = totalCards > 0 
    ? Math.round(allCards.reduce((sum, c) => sum + (c.mastery || 0), 0) / totalCards)
    : 0;

  // Filter weak cards (< 60% mastery)
  const weakCards = allCards.filter(c => (c.mastery || 0) < 60 || c.isHard);

  const getReportTitle = () => {
    return reportType === "standard" 
      ? `Báo Cáo Học Tập Thông Thạo - ${user?.name || 'Học viên'}`
      : `Danh Sách Thẻ Cần Ôn Tập Tập Trung - ${user?.name || 'Học viên'}`;
  };

  const getReportSubtitle = () => {
    return reportType === "standard"
      ? "Tổng quan quá trình tích lũy tri thức, điểm số và mức độ thông thạo từng bộ thẻ."
      : "Tổng hợp các thẻ yếu thuộc mọi danh mục giúp ôn tập nhanh trước kỳ thi.";
  };

  // Create printable text (Markdown format)
  const getMarkdownContent = () => {
    let md = `# ${getReportTitle()}\n`;
    md += `*Thời gian xuất bản: ${new Date().toLocaleString("vi-VN")}*\n\n`;
    
    md += `## 📊 THÔNG TIN HỌC VIÊN & CHỈ SỐ\n`;
    md += `- **Học viên:** ${user?.name || "N/A"}\n`;
    md += `- **Điểm tích lũy (Weekly Points):** ${user?.points || 0} điểm\n`;
    md += `- **Chuỗi học tập hiện tại:** ${user?.streak || 0} ngày 🔥\n`;
    md += `- **Thời gian học tập (tuần này):** ${studyHours} giờ ${studyMinutes} phút\n`;
    md += `- **Mục tiêu ôn tập:** ${dailyReviewed}/${dailyGoal} thẻ hôm nay\n`;
    md += `- **Tổng số bộ thẻ sở hữu:** ${totalDecks}\n`;
    md += `- **Tổng số thẻ ghi nhớ:** ${totalCards}\n`;
    md += `- **Mức độ thông thạo trung bình:** ${avgMastery}%\n\n`;

    md += `## 📚 CHI TIẾT BỘ THẺ & MỨC THÔNG THẠO\n`;
    decks.forEach(d => {
      const dCards = d.cards || [];
      const dMastery = dCards.length > 0 
        ? Math.round(dCards.reduce((s, c) => s + (c.mastery || 0), 0) / dCards.length)
        : 0;
      md += `### ${d.title}\n`;
      md += `- Chủ đề: ${d.subject || "Chung"}\n`;
      md += `- Số lượng thẻ: ${dCards.length}\n`;
      md += `- Chỉ số thông thạo: ${dMastery}%\n\n`;
    });

    if (reportType === "weak_only" || weakCards.length > 0) {
      md += `## ⚠️ DANH SÁCH THẺ YẾU CẦN ÔN LẠI GẤP (${weakCards.length} thẻ)\n`;
      weakCards.forEach((c, idx) => {
        md += `${idx + 1}. **[${c.deckTitle}]**\n`;
        md += `   - Mặt trước (Hỏi): ${c.front}\n`;
        md += `   - Mặt sau (Đáp): ${c.back}\n`;
        md += `   - Độ thông thạo hiện tại: ${c.mastery}% | Trạng thái: ${c.isHard ? "Đánh dấu Khó 🔴" : "Yếu 🟡"}\n\n`;
      });
    }

    md += `---\n*Báo cáo được trích xuất từ hệ thống Henosis Web - Đồng hành cùng chặng đường thông thái của bạn.*`;
    return md;
  };

  const handleCopyText = async () => {
    // Prevent blocking main thread by deferring
    await new Promise(resolve => setTimeout(resolve, 0));
    navigator.clipboard.writeText(getMarkdownContent());
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handlePrint = async () => {
    // Prevent blocking main thread by deferring the heavy DOM mapping
    await new Promise(resolve => setTimeout(resolve, 10));

    const printFrame = document.createElement("iframe");
    printFrame.style.position = "fixed";
    printFrame.style.right = "0";
    printFrame.style.bottom = "0";
    printFrame.style.width = "0";
    printFrame.style.height = "0";
    printFrame.style.border = "0";
    document.body.appendChild(printFrame);

    const frameDoc = printFrame.contentWindow?.document || printFrame.contentDocument;
    if (!frameDoc) return;

    // Filter deck data to only selected format
    const activeDecksHTML = decks.map(d => {
      const dCards = d.cards || [];
      const dMastery = dCards.length > 0 
        ? Math.round(dCards.reduce((s, c) => s + (c.mastery || 0), 0) / dCards.length)
        : 0;
      return `
        <div class="deck-card">
          <div class="deck-header">
            <span>📚 ${d.title}</span>
            <span class="badge ${dMastery >= 80 ? '' : dMastery >= 50 ? 'badge-yellow' : 'badge-red'}">
              Thông thạo: ${dMastery}%
            </span>
          </div>
          <div class="deck-meta">Chủ đề: ${d.subject || "Chung"} | Quy mô: ${dCards.length} thẻ ghi nhớ</div>
        </div>
      `;
    }).join("");

    const targetWeakCards = reportType === "weak_only" 
      ? weakCards 
      : weakCards.slice(0, 50); // Standard layout shows top 50 weak cards to avoid massive document

    const weakCardsHTML = targetWeakCards.length > 0 ? `
      <div class="section-title">⚠️ Danh Sách Thẻ Cần Ôn Tập Tập Trung (${targetWeakCards.length} thẻ)</div>
      <p style="font-size: 12px; color: #57534e; margin-bottom: 15px;">
        Các thẻ có chỉ số thông thạo thấp (< 60%) hoặc bị đánh dấu khó học cần ưu tiên học tập trước.
      </p>
      <table>
        <thead>
          <tr>
            <th style="width: 20%">Bộ Thẻ</th>
            <th style="width: 40%">Mặt Trước (Hỏi / Khái niệm)</th>
            <th style="width: 40%">Mặt Sau (Trả lời / Định nghĩa)</th>
            <th style="width: 10%; text-align: center;">Chỉ số</th>
          </tr>
        </thead>
        <tbody>
          ${targetWeakCards.map(c => `
            <tr>
              <td class="mono font-bold" style="font-size:11px;">${c.deckTitle}</td>
              <td style="font-weight: 500;">${c.front}</td>
              <td style="color: #44403c;">${c.back}</td>
              <td style="text-align: center;">
                <span class="badge badge-red">${c.mastery}%</span>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    ` : `
      <div class="section-title">🎉 Chúc mừng!</div>
      <p style="font-size: 13px;">Bạn chưa có thẻ nào bị xếp hạng yếu dưới 60%. Toàn bộ học liệu đang được học đạt mức tối ưu!</p>
    `;

    // Dynamic adaptive quote
    let stoicQuoteText = "Không có ai rảnh rỗi để làm hài lòng mọi tham vọng lớn của mình ngoại trừ việc tự mài rũa trí tuệ của mình mỗi ngày. - Seneca";
    if (avgMastery < 40) {
      stoicQuoteText = "Khó khăn chính là nguyên liệu quý giá nhất để rèn giũa bản lĩnh kiên cường của một người thông thái. Đừng lùi bước trước thử thách. - Marcus Aurelius";
    } else if (avgMastery >= 75) {
      stoicQuoteText = "Hãy hướng tới đỉnh cao thông thạo tuyệt đối. Những gì bạn đạt được hôm nay là bệ phóng cho ngày mai vĩ đại hơn. - Epictetus";
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>${getReportTitle()}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;700&display=swap');
            body {
              font-family: 'Inter', sans-serif;
              color: #1c1917;
              padding: 40px;
              background-color: #ffffff;
              line-height: 1.6;
              font-size: 13px;
            }
            .header {
              border-bottom: 3px double #d97706;
              padding-bottom: 20px;
              margin-bottom: 25px;
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
            }
            .header-left {
              max-width: 70%;
            }
            .header-right {
              text-align: right;
              font-family: 'JetBrains Mono', monospace;
              font-size: 10px;
              color: #78716c;
            }
            .title {
              font-family: 'Space Grotesk', sans-serif;
              font-size: 24px;
              font-weight: 800;
              margin: 0 0 5px 0;
              color: #b45309;
              text-transform: uppercase;
              letter-spacing: -0.5px;
            }
            .subtitle {
              font-size: 12px;
              color: #57534e;
              margin: 0;
            }
            .stoic-quote {
              font-family: Georgia, serif;
              font-style: italic;
              border-left: 3px solid #d97706;
              padding-left: 15px;
              margin: 20px 0;
              color: #44403c;
              background-color: #fffbeb;
              padding-top: 10px;
              padding-bottom: 10px;
              border-radius: 0 8px 8px 0;
            }
            .stats-grid {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 15px;
              margin: 20px 0;
            }
            .stat-box {
              border: 1px solid #e7e5e4;
              border-radius: 8px;
              padding: 12px;
              background-color: #fafaf9;
              text-align: center;
            }
            .stat-value {
              font-size: 18px;
              font-weight: 700;
              color: #d97706;
              font-family: 'JetBrains Mono', monospace;
              margin-bottom: 3px;
            }
            .stat-label {
              font-size: 10px;
              text-transform: uppercase;
              color: #78716c;
              font-weight: 600;
              letter-spacing: 0.5px;
            }
            .section-title {
              font-family: 'Space Grotesk', sans-serif;
              font-size: 16px;
              font-weight: 700;
              color: #1c1917;
              margin: 30px 0 12px 0;
              border-bottom: 1px solid #d97706;
              padding-bottom: 5px;
              page-break-after: avoid;
            }
            .deck-grid {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 12px;
            }
            .deck-card {
              border: 1px dashed #cbd5e1;
              border-radius: 8px;
              padding: 12px;
              background-color: #fafaf9;
              page-break-inside: avoid;
            }
            .deck-header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              font-weight: 700;
              font-size: 13px;
              color: #1c1917;
            }
            .deck-meta {
              font-size: 11px;
              color: #78716c;
              margin-top: 5px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 15px;
              font-size: 11.5px;
              page-break-inside: auto;
            }
            tr {
              page-break-inside: avoid;
              page-break-after: auto;
            }
            th {
              background-color: #f5f5f4;
              color: #1c1917;
              text-align: left;
              padding: 8px;
              border: 1px solid #cbd5e1;
              font-weight: 700;
              font-size: 11px;
              text-transform: uppercase;
            }
            td {
              padding: 8px;
              border: 1px solid #e2e8f0;
              vertical-align: top;
            }
            .mono {
              font-family: 'JetBrains Mono', monospace;
            }
            .badge {
              display: inline-block;
              padding: 2px 6px;
              border-radius: 4px;
              font-size: 9.5px;
              font-weight: 700;
              background-color: #ecfdf5;
              color: #065f46;
            }
            .badge-yellow {
              background-color: #fef3c7;
              color: #92400e;
            }
            .badge-red {
              background-color: #fee2e2;
              color: #991b1b;
            }
            .footer {
              margin-top: 40px;
              border-top: 1px solid #e7e5e4;
              padding-top: 15px;
              text-align: center;
              font-size: 10px;
              color: #a8a29e;
            }
            @media print {
              body {
                padding: 15px;
                font-size: 12px;
              }
              .title {
                font-size: 20px;
              }
              .section-title {
                margin: 20px 0 10px 0;
              }
              .deck-card {
                background: none;
              }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="header-left">
              <h1 class="title">${getReportTitle()}</h1>
              <p class="subtitle">${getReportSubtitle()}</p>
            </div>
            <div class="header-right">
              <div>XUẤT BẢN: ${new Date().toLocaleDateString("vi-VN")}</div>
              <div>HỆ THỐNG: Henosis Web</div>
              <div>ID HỌC VIÊN: ${user?.id || 'N/A'}</div>
            </div>
          </div>

          <div class="stoic-quote">
            "${stoicQuoteText}"
          </div>

          <div class="stats-grid">
            <div class="stat-box">
              <div class="stat-value">${user?.points || 0}</div>
              <div class="stat-label">Điểm số</div>
            </div>
            <div class="stat-box">
              <div class="stat-value">${user?.streak || 0} Ngày</div>
              <div class="stat-label">Chuỗi (Streak)</div>
            </div>
            <div class="stat-box">
              <div class="stat-value">${avgMastery}%</div>
              <div class="stat-label">Độ thông thạo</div>
            </div>
            <div class="stat-box">
              <div class="stat-value">${weakCards.length}</div>
              <div class="stat-label">Thẻ cần ôn lại</div>
            </div>
          </div>

          ${reportType === "standard" ? `
            <div class="section-title">📊 Tiến Hướng Các Bộ Thẻ Tích Lũy (${totalDecks} bộ)</div>
            <div class="deck-grid">
              ${activeDecksHTML}
            </div>
          ` : ""}

          <div style="page-break-before: always;"></div>

          ${weakCardsHTML}

          <div class="footer">
            Báo cáo học tập này được trích xuất thông minh để hỗ trợ việc ghi nhớ. Hãy luyện tập đều đặn hàng ngày nhằm chuyển hóa thông tin thành rãnh tri thức vĩnh cửu.
          </div>
        </body>
      </html>
    `;

    frameDoc.write(htmlContent);
    frameDoc.close();

    setTimeout(() => {
      printFrame.contentWindow?.focus();
      printFrame.contentWindow?.print();
      setTimeout(() => {
        document.body.removeChild(printFrame);
      }, 1500);
    }, 500);
  };

  return (
    <>
      {/* Sidebar Widget Card */}
      <section className="glass p-6 rounded-xl border border-orange-600/10 dark:border-orange-500/10 hover:border-orange-500/30 transition relative overflow-hidden group">
        <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 w-28 h-28 bg-orange-500/5 blur-2xl rounded-full group-hover:scale-110 transition-transform" />
        <div className="flex items-start gap-4">
          <div className="p-3 bg-gradient-to-br from-orange-500/10 to-orange-500/15 rounded-xl border border-orange-500/20 text-orange-600 dark:text-orange-400">
            <FileDown className="w-6 h-6" />
          </div>
          <div className="space-y-1 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h3 className="text-lg font-display font-black text-zinc-900 dark:text-zinc-50 leading-tight">
                Xuất Thống Kê & Bộ Thẻ
              </h3>
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-orange-500/10 text-orange-600 dark:text-orange-400 uppercase font-mono tracking-wider">
                A11y PDF
              </span>
            </div>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
              In danh sách từ vựng/học liệu cần ôn tập gấp hoặc kết xuất báo cáo thông thạo của ngài để học ngoại tuyến.
            </p>
            <div className="pt-3 flex gap-2">
              <button 
                onClick={() => {
                  setReportType("standard");
                  setShowModal(true);
                }}
                className="flex-1 bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-white text-white dark:text-zinc-950 font-bold py-2 px-3 rounded-lg text-xs flex items-center justify-center gap-1.5 transition active:scale-[0.98] shadow-md border border-black/10 dark:border-white/10"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>In ấn / PDF</span>
              </button>
              <button 
                onClick={handleCopyText}
                className="bg-zinc-200/60 dark:bg-zinc-800/50 hover:bg-black/10 dark:hover:bg-white/10 text-zinc-800 dark:text-zinc-200 p-2 rounded-lg text-xs flex items-center justify-center font-bold tracking-wide transition border border-transparent hover:border-orange-500/20 active:scale-95 shrink-0"
                title="Sao chép định dạng Markdown"
              >
                {isCopied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Export Report / Modal Preview */}
      {showModal && (
        <div id="export-report-modal" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
          <div className="w-full max-w-4xl max-h-[90vh] bg-zinc-50/98 dark:bg-zinc-950/98 backdrop-blur-xl border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            
            {/* Header */}
            <div className="p-6 bg-gradient-to-r from-orange-500/10 to-orange-500/5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
              <div>
                <h4 className="text-xl font-display font-black text-zinc-900 dark:text-zinc-50 uppercase tracking-tight flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-orange-500" /> Cấu hình bản in / xuất tập tin
                </h4>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                  Ngài có thể chọn in toàn bộ báo cáo tổng hợp hoặc gom riêng các thẻ học yếu nhất để in danh sách gấp.
                </p>
              </div>
              <button 
                onClick={() => setShowModal(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 font-bold p-1 rounded-lg text-lg focus:outline-none"
              >
                ✕
              </button>
            </div>

            {/* Selection Options Bar */}
            <div className="px-6 py-4 bg-zinc-100 dark:bg-zinc-900/50 border-b border-zinc-200 dark:border-zinc-800 flex flex-wrap gap-4 items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">ĐỊNH DẠNG:</span>
                <div className="flex bg-zinc-200 dark:bg-zinc-800 p-1 rounded-lg">
                  <button 
                    onClick={() => setReportType("standard")}
                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${reportType === "standard" ? "bg-zinc-50 dark:bg-zinc-950 text-orange-700 dark:text-orange-400 shadow" : "text-zinc-600 dark:text-zinc-400"}`}
                  >
                    Bản chuẩn đầy đủ
                  </button>
                  <button 
                    onClick={() => setReportType("weak_only")}
                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${reportType === "weak_only" ? "bg-zinc-50 dark:bg-zinc-950 text-orange-700 dark:text-orange-400 shadow" : "text-zinc-600 dark:text-zinc-400"}`}
                  >
                    Chỉ lọc thẻ yếu (&lt;60%)
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button 
                  onClick={handleCopyText}
                  className="px-4 py-2 bg-zinc-200/80 dark:bg-zinc-800/80 hover:bg-zinc-300 dark:hover:bg-zinc-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 font-mono"
                >
                  {isCopied ? <Check className="w-3.5 h-3.5 text-green-500 animate-bounce" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{isCopied ? "Đã sao chép!" : "Sao chép Markdown"}</span>
                </button>
                <button 
                  onClick={handlePrint}
                  className="px-4 py-2 bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 text-white font-black rounded-xl text-xs shadow-lg transition flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>XUẤT PDF / IN NGAY 🖨️</span>
                </button>
              </div>
            </div>

            {/* Live Interactive Preview Screen */}
            <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
              
              {/* Report Header Wrapper */}
              <div className="p-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-inner space-y-6 max-w-3xl mx-auto text-zinc-900 dark:text-zinc-100">
                <div className="flex justify-between items-start border-b-2 border-dashed border-orange-600/30 pb-4">
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-mono tracking-widest text-orange-600 dark:text-orange-400 font-bold block">Bản xem trước tài liệu</span>
                    <h5 className="text-xl font-display font-black tracking-tight text-zinc-900 dark:text-white uppercase">
                      {getReportTitle()}
                    </h5>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 italic">
                      {getReportSubtitle()}
                    </p>
                  </div>
                  <div className="text-right font-mono text-[10px] text-zinc-400 leading-normal">
                    <div>XUẤT BẢN: {new Date().toLocaleDateString("vi-VN")}</div>
                    <div>ĐỒNG HÀNH: Henosis Web</div>
                  </div>
                </div>

                {/* Adaptive Motivational Quote */}
                <div className="p-4 bg-orange-50/50 dark:bg-orange-950/10 border-l-4 border-orange-500 rounded-r-xl italic font-serif text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
                  "{avgMastery >= 75 
                    ? "Hãy hướng tới đỉnh cao thông thạo tuyệt đối. Những gì bạn đạt được hôm nay là bệ phóng cho ngày mai vĩ đại hơn. - Epictetus"
                    : avgMastery < 40 
                    ? "Khó khăn chính là nguyên liệu quý giá nhất để rèn giũa bản lĩnh kiên cường của một người thông thái. Đừng lùi bước trước thử thách. - Marcus Aurelius"
                    : "Không có ai rảnh rỗi để làm hài lòng mọi tham vọng lớn của mình ngoại trừ việc tự mài rũa trí tuệ của mình mỗi ngày. - Seneca"
                  }"
                </div>

                {/* General Stats overview */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-3 bg-zinc-100 dark:bg-zinc-800/40 rounded-lg text-center space-y-1 border border-zinc-200/50 dark:border-zinc-800/50">
                    <div className="text-[10px] uppercase font-mono text-zinc-400 font-bold">Điểm tổng</div>
                    <div className="text-lg font-bold text-orange-600 dark:text-orange-400 font-mono flex items-center justify-center gap-1">
                      <Trophy className="w-4 h-4" /> {user?.points || 0}
                    </div>
                  </div>
                  <div className="p-3 bg-zinc-100 dark:bg-zinc-800/40 rounded-lg text-center space-y-1 border border-zinc-200/50 dark:border-zinc-800/50">
                    <div className="text-[10px] uppercase font-mono text-zinc-400 font-bold">Streak</div>
                    <div className="text-lg font-bold text-orange-600 dark:text-orange-400 font-mono flex items-center justify-center gap-1">
                      <Flame className="w-4 h-4" /> {user?.streak || 0} ngày
                    </div>
                  </div>
                  <div className="p-3 bg-zinc-100 dark:bg-zinc-800/40 rounded-lg text-center space-y-1 border border-zinc-200/50 dark:border-zinc-800/50">
                    <div className="text-[10px] uppercase font-mono text-zinc-400 font-bold">Thông thạo</div>
                    <div className="text-lg font-bold text-green-600 dark:text-green-400 font-mono flex items-center justify-center gap-1">
                      <BrainCircuit className="w-4 h-4" /> {avgMastery}%
                    </div>
                  </div>
                  <div className="p-3 bg-zinc-100 dark:bg-zinc-800/40 rounded-lg text-center space-y-1 border border-zinc-200/50 dark:border-zinc-800/50">
                    <div className="text-[10px] uppercase font-mono text-zinc-400 font-bold">Thẻ yếu cần học</div>
                    <div className="text-lg font-bold text-red-500 font-mono flex items-center justify-center gap-1">
                      <AlertTriangle className="w-4 h-4" /> {weakCards.length}
                    </div>
                  </div>
                </div>

                {/* Section Decks scale (if standard layout has been selected) */}
                {reportType === "standard" && (
                  <div className="space-y-3">
                    <div className="text-xs uppercase font-mono font-bold text-zinc-400 flex items-center gap-1.5">
                      <BookOpen className="w-4 h-4" /> Thống kê bộ bài ({totalDecks} bộ bài)
                    </div>
                    <div className="grid sm:grid-cols-2 gap-3">
                      {decks.map(d => {
                        const dCards = d.cards || [];
                        const dMastery = dCards.length > 0
                          ? Math.round(dCards.reduce((s, c) => s + (c.mastery || 0), 0) / dCards.length)
                          : 0;
                        return (
                          <div key={d.id} className="p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 flex flex-col justify-between">
                            <div className="flex justify-between items-start">
                              <span className="font-bold text-xs font-sans text-zinc-800 dark:text-zinc-200 break-all">{d.title}</span>
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded font-mono ${dMastery >= 75 ? 'bg-green-500/10 text-green-600 dark:text-green-400' : 'bg-orange-500/10 text-orange-600'}`}>
                                {dMastery}%
                              </span>
                            </div>
                            <span className="text-[10px] text-zinc-400 mt-2">Chủ đề: {d.subject || "Chung"} | Quy mô: {dCards.length} thẻ</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Section list details of failing flashcards */}
                <div className="space-y-3 pt-4 border-t border-zinc-150 dark:border-zinc-800">
                  <div className="text-xs uppercase font-mono font-bold text-zinc-400 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-red-500" />
                    Danh sách chi tiết từ vựng/học liệu học yếu ({weakCards.length} thẻ có độ thạo thấp &lt;60%)
                  </div>
                  
                  {weakCards.length > 0 ? (
                    <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-zinc-100 dark:bg-zinc-800 text-[10px] text-zinc-500 uppercase tracking-wider font-bold">
                            <th className="p-3 border-b border-zinc-200 dark:border-zinc-800">Khối bài</th>
                            <th className="p-3 border-b border-zinc-200 dark:border-zinc-800">Mặt trước (Hỏi)</th>
                            <th className="p-3 border-b border-zinc-200 dark:border-zinc-800">Mặt sau (Đáp)</th>
                            <th className="p-3 border-b border-zinc-200 dark:border-zinc-800 text-center">Thạo</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-150 dark:divide-zinc-800 text-xs">
                          {weakCards.slice(0, 15).map((c, index) => (
                            <tr key={c.id || index} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50">
                              <td className="p-3 font-semibold text-[10px] font-mono text-orange-700 dark:text-orange-400 break-all">{c.deckTitle}</td>
                              <td className="p-3 font-medium font-sans text-zinc-800 dark:text-zinc-200 break-all">{c.front}</td>
                              <td className="p-3 text-zinc-600 dark:text-zinc-400 break-all">{c.back}</td>
                              <td className="p-3 text-center">
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-black font-mono bg-red-500/10 text-red-650 dark:text-red-450 border border-red-500/10">
                                  {c.mastery}%
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {weakCards.length > 15 && (
                        <div className="p-3 bg-zinc-100 dark:bg-zinc-900/80 text-center text-[10px] font-bold text-zinc-400 uppercase tracking-widest border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-center gap-1">
                          <Info className="w-3.5 h-3.5" /> Còn {weakCards.length - 15} thẻ ghi nhớ yếu khác sẽ được kết xuất đầy đủ khi in hoặc xuất PDF!
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-8 text-center text-xs text-zinc-400 dark:text-zinc-500 flex flex-col items-center justify-center gap-2">
                      <CheckCircle2 className="w-8 h-8 text-green-500 animate-pulse" />
                      <span>Không tìm thấy từ vựng hay thẻ học nào bị phân loại yếu! Điểm số thông thạo của ngài cực kỳ tuyệt vời.</span>
                    </div>
                  )}
                </div>

              </div>
              
            </div>

            {/* Footer buttons row */}
            <div className="p-6 bg-zinc-100 dark:bg-zinc-900/80 border-t border-zinc-200 dark:border-zinc-800 flex justify-between items-center">
              <span className="text-[10px] uppercase font-mono text-zinc-400 font-bold block">
                Henosis A11y Export Studio - V1.1.2
              </span>
              <div className="flex gap-3">
                <button 
                  onClick={() => setShowModal(false)}
                  className="px-5 py-2.5 bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-xl text-xs font-bold transition hover:bg-zinc-300 dark:hover:bg-zinc-700 focus:outline-none"
                >
                  Đóng lại
                </button>
                <button 
                  onClick={handlePrint}
                  className="px-6 py-2.5 bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 text-white font-extrabold rounded-xl text-xs shadow-lg transition transform active:scale-95 flex items-center gap-2"
                >
                  <Printer className="w-4 h-4" />
                  <span>XUẤT FILE PDF / IN</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}
    </>
  );
};
