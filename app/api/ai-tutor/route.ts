import { NextRequest, NextResponse } from 'next/server';
import { gemini } from '@/lib/ai/gemini-client';

export interface AITutorRequest {
  subject: string;
  lessonTitle: string;
  questionContent: string;
  options: { id: string; label: string }[];
  correctAnswer: string;
  selectedAnswer: string;
  explanation: string;
  userMessage: string;
}

export interface AITutorResponse {
  answer: string;
}

const SYSTEM_PROMPT = `Bạn là AI trợ giảng của nền tảng học tập Tú Tài, chuyên hỗ trợ học sinh lớp 12 ôn thi THPT Quốc Gia.

Quy tắc:
- Trả lời bằng tiếng Việt, thân thiện, rõ ràng, chính xác về toán học.
- Giải thích từng bước, dùng ký hiệu toán học Unicode thông thường (không dùng LaTeX phức tạp).
- Tập trung vào bài học cụ thể được cung cấp trong ngữ cảnh.
- Không được bịa đặt đáp án. Nếu không biết, hãy thừa nhận và gợi ý học sinh tra cứu thêm.
- Trả lời ngắn gọn, không quá dài dòng (tối đa 250 từ).
- Sử dụng ký hiệu: ∞, ≤, ≥, ≠, →, ⇔, ∀, ∃, ∈ thay vì LaTeX.`;

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: AITutorRequest;
  try {
    body = (await req.json()) as AITutorRequest;
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const {
    subject,
    lessonTitle,
    questionContent,
    options,
    correctAnswer,
    selectedAnswer,
    explanation,
    userMessage,
  } = body;

  if (!userMessage?.trim()) {
    return NextResponse.json({ error: 'userMessage is required' }, { status: 400 });
  }

  const optionsText = options.map((o) => `  ${o.id.toUpperCase()}. ${o.label}`).join('\n');

  const selectedLabel = options.find((o) => o.id === selectedAnswer)?.label ?? selectedAnswer;
  const correctLabel = options.find((o) => o.id === correctAnswer)?.label ?? correctAnswer;

  const contextBlock = `
Môn học: ${subject}
Bài học: ${lessonTitle}

Câu hỏi:
${questionContent}

Các đáp án:
${optionsText}

Học sinh đã chọn: ${selectedAnswer.toUpperCase()}. ${selectedLabel}
Đáp án đúng: ${correctAnswer.toUpperCase()}. ${correctLabel}

Giải thích có sẵn:
${explanation || '(Chưa có giải thích)'}
`.trim();

  const fullPrompt = `${SYSTEM_PROMPT}

---
NGỮ CẢNH BÀI TẬP:
${contextBlock}
---

Câu hỏi của học sinh: ${userMessage}`;

  try {
    const response = await gemini.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
    });

    const answer = response.text ?? 'Xin lỗi, AI không thể tạo câu trả lời lúc này.';

    return NextResponse.json({ answer } satisfies AITutorResponse);
  } catch (err) {
    console.error('[ai-tutor] Gemini error:', err);
    return NextResponse.json({ error: 'AI service unavailable' }, { status: 502 });
  }
}
