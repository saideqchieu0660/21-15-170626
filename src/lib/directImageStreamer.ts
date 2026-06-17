/**
 * Direct Client-Side Gemini REST Image Streamer
 * Handles heavy/long images directly from browser to avoid serverless proxy timeout (503).
 */

const SYSTEM_PROMPT = `
# SYSTEM PROMPT: EXTRACTION ENGINE (COMPACT MAX-TOKEN MODE)
## 1. CORE DIRECTIVE (ZERO WASTE)
You are a deterministic Multimodal Data Extraction Agent operating at temperature = 0. Your sole purpose is to convert content from high-density images or text blocks into an hyper-compact JSON payload. Extract EVERY SINGLE item line-by-line from top to bottom without skipping or summarizing.
## 2. HYPER-COMPACT JSON FORMAT CONSTRAINT
- Output ONLY the raw valid JSON object. No conversational text, no markdown syntax codeblocks (do NOT use \`\`\`json). Start with { and end with }.
- No Indentation/Newlines: Minify the JSON output structure. Write things as densely as possible.
- Field Stripping: Completely EXCLUDE any 'category' fields. Focus strictly on target vocabulary node values.
## 3. STATE & PROGRESS METADATA SCHEMA
The very first keys in the root JSON object must strictly handle lazy chunking state boundaries using // characters:
{"//_STATUS":"Chunk X","//_CURRENT_CHUNK":X,"//_HAS_MORE":true,"data":[]}
## 4. TARGET COMPACT SCHEMA
{"//_STATUS":"Chunk 1","//_CURRENT_CHUNK":1,"//_HAS_MORE":true,"data":[{"front":"Target word/idiom/collocation","back":"Vietnamese definition","example":"Context sentence"}]}
`.trim();

interface StreamOptions {
  file: File;
  onProgress: (statusText: string, bytesReceived: number) => void;
  onLog: (message: string, isError?: boolean) => void;
  onChunkText: (text: string) => void;
}

export async function checkAndFetchApiKey(): Promise<string> {
  const response = await fetch("/api/automation/get-streaming-key");
  if (!response.ok) {
    throw new Error(`Failed to fetch streaming API key: ${response.statusText}`);
  }
  const data = await response.json();
  if (!data?.success || !data?.key) {
    throw new Error("No valid Gemini API key returned from secure server.");
  }
  return data.key;
}

export async function streamExtractImageContent(options: StreamOptions): Promise<any[]> {
  const { file, onProgress, onLog, onChunkText } = options;
  
  onLog("🛰️ Bắt đầu tiến trình bóc tách ảnh bằng REST Streaming trực tiếp...");
  
  // 1. Fetch API Key dynamic via system secure endpoint
  onProgress("Đang lấy mã khóa bảo mật từ vệ tinh...", 0);
  const apiKey = await checkAndFetchApiKey();
  onLog("🔑 Đã nhận diện mã khóa bảo mật động thành công.");

  // 2. Transcode image to base64
  onProgress("Đang mã hóa dữ liệu hình ảnh (Base64)...", 0);
  const base64Data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1] || result;
      resolve(base64);
    };
    reader.onerror = (e) => reject(e);
    reader.readAsDataURL(file);
  });

  onLog(`📸 Đã nén ảnh '${file.name}' (${(file.size / 1024 / 1024).toFixed(2)} MB) thành chuỗi nhị phân.`);

  // 3. Initiate client-side streaming fetch session
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?key=${apiKey}`;
  
  onProgress("Đang tạo đường truyền HTTP Stream với Google AI...", 0);
  
  const payload = {
    contents: [
      {
        parts: [
          { text: SYSTEM_PROMPT },
          {
            inlineData: {
              mimeType: file.type || "image/jpeg",
              data: base64Data
            }
          }
        ]
      }
    ],
    generationConfig: {
      temperature: 0,
    }
  };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errText = await response.text();
    onLog(`🚨 Google API trả về lỗi HTTP ${response.status}: ${errText}`, true);
    throw new Error(`Google REST API Error: ${response.statusText}`);
  }

  if (!response.body) {
    throw new Error("Mật độ luồng rỗng, thiết bị không hỗ trợ stream đọc.");
  }

  // 4. Read stream chunk-by-chunk in real-time
  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let done = false;
  let bytesReceived = 0;
  let accumulatedRawStreamText = "";
  let accumulatedOutputText = "";

  const streamParser = new GeminiStreamParser((newText) => {
    accumulatedOutputText += newText;
    onChunkText(newText);
  });

  onLog("📡 Kết nối thành công! Đang đọc dòng dữ liệu hồi đáp liên tục (Chống 503 Timeout)...");

  while (!done) {
    const { value, done: readerDone } = await reader.read();
    if (readerDone) {
      done = true;
      break;
    }

    if (value) {
      bytesReceived += value.length;
      const textChunk = decoder.decode(value, { stream: true });
      accumulatedRawStreamText += textChunk;
      
      onProgress(`Đang truyền tải dữ liệu trực tiếp từ vệ tinh Google AI (Streaming) - Thu nhận: ${(bytesReceived / 1024).toFixed(1)} KB...`, bytesReceived);
      
      streamParser.append(textChunk);
    }
  }

  onLog(`📥 Kết thúc truyền luồng. Tổng lượng tải cơ sở: ${(bytesReceived / 1024).toFixed(1)} KB.`);

  let finalJsonString = accumulatedOutputText.trim();
  
  if (finalJsonString && !finalJsonString.endsWith("}")) {
    onLog("🔧 Phát hiện cấu trúc JSON bị ngắt giữa dòng. Khởi chạy bộ tu sửa khẩn cấp Client-side...");
    if (finalJsonString.includes('"data":[')) {
      if (finalJsonString.endsWith("]")) {
        finalJsonString += "}";
      } else {
        finalJsonString += "]}";
      }
    } else {
      finalJsonString += "]}";
    }
    onLog("🩹 Đã tự động vá các ký tự đóng JSON đóng ngoặc khuyết thiếu.");
  }

  onLog("🧹 Đang thực thi phân tích cấu trúc dữ liệu thẻ học...");

  try {
    const cleanData = JSON.parse(finalJsonString);
    if (!cleanData || !Array.isArray(cleanData.data)) {
      throw new Error("Không thể bóc được mảng 'data' hợp lệ từ chuỗi kết quả.");
    }
    return cleanData.data;
  } catch (err: any) {
    onLog(`🚨 Lỗi cấu pháp phân tích JSON: ${err.message}. Đang thử cứu trợ cấu trúc thô...`, true);
    const backupCards = tryRegexParseBrokenJson(finalJsonString);
    if (backupCards && backupCards.length > 0) {
      onLog(`🩹 Phục hồi thành công ${backupCards.length} thẻ học nhờ bộ phân tách biểu thức chính quy (Regex).`);
      return backupCards;
    }
    throw new Error(`Dữ liệu JSON lỗi nghiêm trọng không thể cứu vãn: ${err.message}`);
  }
}

function tryRegexParseBrokenJson(jsonText: string): any[] {
  const cards: any[] = [];
  const cardBlockRegex = /\{[^{}]*"front"\s*:\s*"([^"]*)"[^{}]*"back"\s*:\s*"([^"]*)"[^{}]*"example"\s*:\s*"([^"]*)"[^{}]*\}/g;
  
  let match;
  while ((match = cardBlockRegex.exec(jsonText)) !== null) {
    try {
      cards.push({
        front: match[1],
        back: match[2],
        example: match[3],
        wordForm: "",
        ipa: "",
        origin: ""
      });
    } catch (e) {}
  }
  return cards;
}

class GeminiStreamParser {
  private buffer = "";
  private hasOpenedArray = false;

  constructor(private onTextChunk: (text: string) => void) {}

  public append(chunkText: string) {
    this.buffer += chunkText;
    
    let cleanBuffer = this.buffer.trim();
    if (!this.hasOpenedArray && cleanBuffer.startsWith("[")) {
      cleanBuffer = cleanBuffer.substring(1).trim();
      this.hasOpenedArray = true;
    }
    
    if (cleanBuffer.startsWith(",")) {
      cleanBuffer = cleanBuffer.substring(1).trim();
    }

    let searchIndex = 0;
    while (searchIndex < cleanBuffer.length) {
      if (cleanBuffer[searchIndex] === "{") {
        let braceCount = 0;
        let inString = false;
        let escaped = false;
        let endIdx = -1;
        
        for (let j = searchIndex; j < cleanBuffer.length; j++) {
          const char = cleanBuffer[j];
          if (escaped) {
            escaped = false;
            continue;
          }
          if (char === "\\") {
            escaped = true;
            continue;
          }
          if (char === '"') {
            inString = !inString;
            continue;
          }
          if (!inString) {
            if (char === "{") {
              braceCount++;
            } else if (char === "}") {
              braceCount--;
              if (braceCount === 0) {
                endIdx = j;
                break;
              }
            }
          }
        }
        
        if (endIdx !== -1) {
          const objStr = cleanBuffer.substring(searchIndex, endIdx + 1);
          try {
            const parsedObj = JSON.parse(objStr);
            const textPart = parsedObj?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (textPart) {
              this.onTextChunk(textPart);
            }
          } catch (e) {
            const regex = /"text"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
            let match;
            while ((match = regex.exec(objStr)) !== null) {
              try {
                const decoded = JSON.parse(`"${match[1]}"`);
                this.onTextChunk(decoded);
              } catch (err) {
                this.onTextChunk(match[1]);
              }
            }
          }
          cleanBuffer = cleanBuffer.substring(endIdx + 1).trim();
          if (cleanBuffer.startsWith(",")) {
            cleanBuffer = cleanBuffer.substring(1).trim();
          }
          searchIndex = 0;
        } else {
          break;
        }
      } else {
        searchIndex++;
      }
    }
    this.buffer = (this.hasOpenedArray ? "[" : "") + cleanBuffer;
  }
}
