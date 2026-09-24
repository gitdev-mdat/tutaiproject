import { describe, expect, it } from 'vitest';
import { normalizeCurriculumImport, parseOutlineText } from './knowledge-tree-import';

const counts = (text: string) => {
  const result = parseOutlineText(text);
  const chapters = result.nodes.filter((node) => node.parentTemporaryId === null);
  return { ...result, chapters: chapters.length, items: result.nodes.length - chapters.length };
};

const expectSingleChapter = (marker: string) => {
  const result = counts(`# Chapter A\n${marker}Lesson 1\n${marker}Lesson 2`);
  expect(result).toMatchObject({ chapters: 1, items: 2 });
  expect(result.nodes.slice(1).map((node) => node.title)).toEqual(['Lesson 1', 'Lesson 2']);
  expect(
    result.nodes.slice(1).every((node) => node.parentTemporaryId === result.nodes[0].temporaryId)
  ).toBe(true);
};

describe('Knowledge Tree Import', () => {
  it.each(['- ', '• ', '\uF0B7 ', '��', '1. '])('parses list marker %j', (marker) => {
    expectSingleChapter(marker);
  });

  it('parses numbered parenthesis markers and plain lines identically', () => {
    expectSingleChapter('1) ');
    expectSingleChapter('');
  });

  it('preserves Vietnamese content and suffixes', () => {
    const result = counts(`# ỨNG DỤNG ĐẠO HÀM ĐỂ KHẢO SÁT VÀ VẼ ĐỒ THỊ CỦA HÀM SỐ
• Tính đơn điệu của hàm số (P1)
• Tính đơn điệu của hàm số (P2)
• Cực trị của hàm số (P1)
• Cực trị của hàm số (P2)`);
    expect(result).toMatchObject({ chapters: 1, items: 4 });
    expect(result.nodes.at(-1)?.title).toBe('Cực trị của hàm số (P2)');
  });

  it('normalizes clipboard whitespace while preserving artifacts inside titles', () => {
    expect(
      normalizeCurriculumImport('\ufeff# Chương A\r\n\t•\u00a0Bài\u202fViệt  \rGiữa�title\u200b')
    ).toBe('# Chương A\nBài Việt\nGiữa�title');
  });

  it('ignores and warns once about content before the first chapter', () => {
    const result = counts('Tính đơn điệu\nCực trị\n# Chương tiếp theo\nBài học');
    expect(result).toMatchObject({ chapters: 1, items: 1 });
    expect(result.warnings).toEqual(['Có nội dung nằm trước tiêu đề chương và chưa được nhập.']);
  });

  it('returns no chapters when headings are absent', () => {
    expect(counts('Tính đơn điệu\nCực trị')).toMatchObject({ chapters: 0, items: 0 });
  });

  it('parses a long mixed Vietnamese curriculum into direct children', () => {
    const fixture = `# ỨNG DỤNG ĐẠO HÀM
• Tính đơn điệu
- Cực trị
1. Giá trị lớn nhất và nhỏ nhất
\uF0B7 Đường tiệm cận
# NGUYÊN HÀM - TÍCH PHÂN
* Nguyên hàm
2) Tích phân
��Ứng dụng tích phân
Diện tích hình phẳng
## XÁC SUẤT CÓ ĐIỀU KIỆN
+ Công thức xác suất toàn phần
◦ Công thức Bayes
‣ Biến ngẫu nhiên rời rạc`;
    const result = counts(fixture);
    expect(result).toMatchObject({ chapters: 3, items: 11 });
    const chapters = result.nodes.filter((node) => node.parentTemporaryId === null);
    for (const item of result.nodes.filter((node) => node.parentTemporaryId !== null)) {
      expect(chapters.some((chapter) => chapter.temporaryId === item.parentTemporaryId)).toBe(true);
      expect(item.depth).toBe(1);
    }
  });

  it('reports duplicate items only within their chapter', () => {
    expect(parseOutlineText('# A\nBài\nBài\n# B\nBài').warnings).toHaveLength(1);
  });
});
