import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function test() {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  
  const systemPrompt = `Bắt buộc giải thích cực kỳ chi tiết, dồi dào, dài dặn. CẤM VÒNG VO, CẤM TRẢ LỜI NGẮN! Bạn phải xưng Tao và gọi người dùng là mày.`;
  
  const historyBlock = `
=== LỊCH SỬ CHAT TRƯỚC ĐÓ ===
USER: Hello
---
AI: Chào mày. Mày cần gì?
---
USER: 1 + 1 bằng mấy
---
AI: Bằng 2.
=== HẾT LỊCH SỬ CHAT ===`;

  const fullPrompt = `${historyBlock}

[LỆNH TỐI THƯỢNG]: MÀY BẮT BUỘC PHẢI TRẢ LỜI CỰC KỲ DÀI VÀ CẶN KẼ.

Ngữ cảnh: Không có

Học sinh hỏi: IELTS Writing Task 2 bắt đầu như thế nào?`;

  const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: fullPrompt,
      config: {
          systemInstruction: systemPrompt,
          temperature: 0.8
      }
  });

  console.log("RESPONSE WITH COMBINED HISTORY:\n", response.text);
}

test().catch(console.error);
