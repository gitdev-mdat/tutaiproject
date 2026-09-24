import type { ImportSession, SourcePage } from './types';

export type UploadValidationLevel = 'INFO' | 'REVIEW' | 'BLOCKING';
export type UploadValidationAction =
  'VIEW_PAGE' | 'CHANGE_PAGE_TYPE' | 'DELETE_DUPLICATE' | 'REORDER';

export interface UploadValidationIssue {
  id: string;
  level: UploadValidationLevel;
  message: string;
  action?: UploadValidationAction;
  actionLabel?: string;
  pageId?: string;
}

function pageIssue(page: SourcePage, warning: string): UploadValidationIssue | null {
  if (warning === 'DUPLICATE_IMAGE') {
    return {
      id: `${page.id}:duplicate`,
      level: 'REVIEW',
      message: `Trang ${String(page.order).padStart(2, '0')} có nội dung trùng với một ảnh đã tải.`,
      action: 'DELETE_DUPLICATE',
      actionLabel: 'Xóa bản trùng',
      pageId: page.id,
    };
  }
  if (warning === 'LOW_RESOLUTION') {
    return {
      id: `${page.id}:resolution`,
      level: 'REVIEW',
      message: `Trang ${String(page.order).padStart(2, '0')} có độ phân giải thấp và có thể làm giảm độ chính xác khi nhận diện công thức.`,
      action: 'VIEW_PAGE',
      actionLabel: 'Xem ảnh',
      pageId: page.id,
    };
  }
  if (warning === 'LANDSCAPE') {
    return {
      id: `${page.id}:rotation`,
      level: 'REVIEW',
      message: `Trang ${String(page.order).padStart(2, '0')} có thể đang sai hướng xoay.`,
      action: 'VIEW_PAGE',
      actionLabel: 'Xem ảnh',
      pageId: page.id,
    };
  }
  return null;
}

export function validateExamUpload(session: ImportSession): UploadValidationIssue[] {
  const issues: UploadValidationIssue[] = [];
  if (!session.pages.some((page) => page.pageType === 'EXAM_PAGE')) {
    issues.push({
      id: 'missing-exam-page',
      level: 'BLOCKING',
      message: 'Phiên import chưa có trang nào được xác định là Trang đề.',
      action: 'CHANGE_PAGE_TYPE',
      actionLabel: 'Đổi loại trang',
    });
  }
  const answerPages = session.pages.filter((page) => page.pageType === 'ANSWER_KEY');
  if (answerPages.length === 0) {
    issues.push({
      id: 'missing-answer-page',
      level: 'INFO',
      message: 'Chưa có ảnh đáp án. Em vẫn có thể tiếp tục và bổ sung đáp án sau.',
    });
  } else if (answerPages.length > 1) {
    issues.push({
      id: 'multiple-answer-pages',
      level: 'REVIEW',
      message: `Có ${answerPages.length} trang được gắn là Đáp án. Hãy kiểm tra lại trước khi xử lý.`,
      action: 'CHANGE_PAGE_TYPE',
      actionLabel: 'Kiểm tra loại trang',
    });
  }
  for (const page of session.pages) {
    for (const warning of page.warnings) {
      const issue = pageIssue(page, warning);
      if (issue) issues.push(issue);
    }
  }
  return issues;
}
