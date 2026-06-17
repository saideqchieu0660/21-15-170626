const responseStyle = "detailed";
let responseMode: string = "socratic";
const isConciseMode = false;
let conciseModeGuidance = "";
const context = "IELTS context";
const message = "How to write task 2";

const socraticRule = responseStyle === "detailed"
    ? `2. PHONG CÁCH SOCRATIC TRONG CHẾ ĐỘ CHI TIẾT (ĐẶC BIỆT CHUYÊN SÂU):
- Tao BẮT BUỘC phải xông thẳng vào giải thích giải nghĩa cực kỳ tường tận, sâu sắc, cặn kẽ và hào phóng mặt thông tin (cung cấp toàn bộ khái niệm, bản chất khoa học học thuật, nguyên lý, mã trực quan, lời giải hoàn chỉnh) ở phần thân bài. TUYỆT ĐỐI KHÔNG BỎ QUA LÝ THUYẾT NỀN TẢNG. Cấm bắt chước lỗi trả lời ngắn của bản thân trong quá khứ!
- Sau khi đã cung cấp khối lượng kiến thức đồ sộ cặn kẽ (thân bài chiếm 95% cuộc đối thoại), tao MỚI ĐƯỢC PHÉP đặt thêm duy nhất một câu hỏi gợi mở vận dụng/nâng cao ở dòng cuối cùng của câu trả lời.`
    : "Socratic Short.";

let systemPrompt = `QUY TẮC BẮT BUỘC:
${socraticRule}
${responseStyle === "detailed" ? "3. BẮT BUỘC GIẢI THÍCH CHI TIẾT: Tao cực kỳ căm ghét những câu trả lời ngắn gọn, hời hợt. Tao phải giải nghĩa rành mạch, đi sâu vào gốc rễ, chia mục rõ ràng, dồi dào, sắc sảo." : "3. CẤM VÒNG VO"}
4. CẤM BẮT CHƯỚC LỊCH SỬ NẾU SAI CHẾ ĐỘ.
5. PHONG CÁCH PHẢN HỒI: ${responseStyle === "detailed" ? "GIẢI THÍCH CHI TIẾT" : "SHORT"}
`;

let fullPrompt = "";
const styleChangeWarning = "\n[CẢNH BÁO: PHONG CÁCH TRẢ LỜI ĐÃ THAY ĐỔI. TUYỆT ĐỐI KHÔNG BẮT CHƯỚC HOẶC LẶP LẠI FORMAT/ĐỘ DÀI CỦA CÁC CÂU TRẢ LỜI TRƯỚC ĐÓ!]";

if (responseMode === "direct") {
    // direct
} else {
    const styleNotice = responseStyle === "detailed"
        ? "⚠️ QUÂN LỆNH CHI TIẾT SOCRATES: Mày BẮT BUỘC phải giải thích đầy đủ định nghĩa, cốt lõi bản chất... Thân bài phải dài dằng dặc ít nhất 350-500 từ."
        : "SHORT notice";
    fullPrompt = `${styleChangeWarning}\nNgữ cảnh: ${context}\n${styleNotice}\n\nHọc sinh hỏi: ${message}`;
}
console.log("SYSTEM PROMPT:", systemPrompt);
console.log("FULL PROMPT:", fullPrompt);
