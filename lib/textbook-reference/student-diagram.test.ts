import { describe, expect, it } from 'vitest';
import {
  hasStudentVisibleDiagram,
  Q22_DERIVATIVE_GRAPH,
  VERIFIED_Q22_ARTIFACT_ID,
} from './student-diagram';

describe('student-visible textbook graph', () => {
  const q22 = {
    id: VERIFIED_Q22_ARTIFACT_ID,
    hasDiagram: true,
    stem: "Cho hàm số f(x) xác định trên R và có đồ thị hàm số y = f'(x) là đường cong trong hình bên. Mệnh đề nào đúng?",
    choices: [
      { label: 'A', text: 'f đồng biến trên (1;2)' },
      { label: 'B', text: 'f nghịch biến trên (0;2)' },
      { label: 'C', text: 'f đồng biến trên (-2;1)' },
      { label: 'D', text: 'f nghịch biến trên (-1;1)' },
    ],
    explanation: "Nhận thấy trên (-∞;-2) và (0;2) thì f'(x) < 0 nên f nghịch biến trên (0;2).",
  };

  it('supports the verified Q22 graph and its independently readable asset', () => {
    expect(hasStudentVisibleDiagram(q22)).toBe(true);
    expect(Q22_DERIVATIVE_GRAPH).toBe('/textbook-figures/derivative-sign-q22.svg');
  });

  it('keeps unrelated or insufficiently evidenced diagrams blocked', () => {
    expect(hasStudentVisibleDiagram({ ...q22, stem: 'Đọc đồ thị trong hình bên.' })).toBe(false);
    expect(hasStudentVisibleDiagram({ ...q22, id: 'another-book-q22' })).toBe(false);
    expect(hasStudentVisibleDiagram({ ...q22, explanation: 'Chọn B theo đáp án của sách.' })).toBe(
      false
    );
  });
});
