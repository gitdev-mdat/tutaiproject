/**
 * Student portal user-facing strings (Vietnamese).
 */
export const studentMessages = {
  // Dashboard
  dashboardTitle: 'Trang chủ',
  dashboardWelcome: 'Chào buổi {timeOfDay}, {name}',
  dashboardTodaySession: 'Phiên học hôm nay',
  dashboardNextTasks: 'Nhiệm vụ tiếp theo',
  dashboardWeeklyProgress: 'Tiến độ tuần này',
  dashboardStartSession: 'Bắt đầu ngay',
  dashboardNoTasks: 'Không có nhiệm vụ nào cho hôm nay. Nghỉ ngơi đi!',
  dashboardStreak: 'Chuỗi ngày học',
  dashboardStreakDays: '{count} ngày',
  dashboardCompetencySummary: 'Mức độ thành thạo',
  dashboardTimeSpent: 'Thời gian học',
  dashboardHoursThisWeek: '{hours} giờ tuần này',

  // Roadmap
  roadmapTitle: 'Lộ trình học tập',
  roadmapStageLearning: 'Đang học',
  roadmapStageChapterReview: 'Ôn chương',
  roadmapStageSemesterReview: 'Ôn học kỳ',
  roadmapStageExamPrep: 'Luyện thi',
  roadmapNextUp: 'Tiếp theo',
  roadmapCompleted: 'Đã hoàn thành',
  roadmapInProgress: 'Đang tiến hành',
  roadmapLocked: 'Chưa mở',
  roadmapProgressChapter: 'Chương {chapter}',
  roadmapReadyToStart: 'Sẵn sàng bắt đầu',
  roadmapWaitPrerequisites: 'Chờ hoàn thành kiến thức trước',

  // Lesson
  lessonTitle: 'Bài học',
  lessonStart: 'Bắt đầu bài học',
  lessonContinue: 'Tiếp tục',
  lessonComplete: 'Hoàn thành',
  lessonEstimatedTime: 'Khoảng {minutes} phút',
  lessonRelatedTopics: 'Chủ đề liên quan',
  lessonNextLesson: 'Bài học tiếp theo',

  // Practice
  practiceTitle: 'Luyện tập',
  practiceStart: 'Bắt đầu luyện tập',
  practiceQuestion: 'Câu hỏi {current}/{total}',
  practiceSubmit: 'Nộp câu trả lời',
  practiceNext: 'Câu tiếp theo',
  practiceFinish: 'Kết thúc',
  practiceCorrect: 'Chính xác',
  practiceIncorrect: 'Chưa đúng',
  practiceExplanation: 'Giải thích',
  practiceTimeUp: 'Hết giờ!',
  practiceSkip: 'Bỏ qua',
  practiceShowAnswer: 'Hiển thị đáp án',
  practiceTryAgain: 'Thử lại',
  practiceKeepGoing: 'Tiếp tục',

  // Quiz
  quizTitle: 'Kiểm tra',
  quizStart: 'Bắt đầu kiểm tra',
  quizTimeRemaining: 'Thời gian còn lại',
  quizSubmit: 'Nộp bài',
  quizSubmitConfirm: 'Bạn có chắc muốn nộp bài?',
  quizResult: 'Kết quả kiểm tra',
  quizScore: '{correct}/{total} câu đúng',
  quizPercentage: '{percent}%',
  quizReviewAnswers: 'Xem lại đáp án',
  quizRetry: 'Làm lại',
  quizRoadmapUpdated: 'Lộ trình đã được cập nhật dựa trên kết quả của bạn.',
  quizWeakUnits: 'Các chủ đề cần ôn luyện thêm:',

  // Mock Exam
  mockExamTitle: 'Đề thi thử',
  mockExamStart: 'Bắt đầu thi',
  mockExamInstructions: 'Làm bài thi như thi thật. Không sử dụng tài liệu.',
  mockExamSubmitConfirm: 'Bạn có chắc nộp bài không?',
  mockExamComplete: 'Hoàn thành đề thi',
  mockExamSessionEnded: 'Phiên thi đã kết thúc',

  // Flashcards
  flashcardsTitle: 'Flashcards',
  flashcardsShowAnswer: 'Lật thẻ',
  flashcardsKnow: 'Tôi biết rồi',
  flashcardsStillLearning: 'Vẫn đang học',
  flashcardsFlip: 'Lật thẻ',
  flashcardsProgress: '{current}/{total} thẻ',
  flashcardsComplete: 'Hoàn thành bộ thẻ!',

  // Review
  reviewTitle: 'Ôn tập',
  reviewDueNow: 'Cần ôn tập ngay',
  reviewUpcoming: 'Sắp đến hạn ôn',
  reviewSessionComplete: 'Phiên ôn tập hoàn thành',
  reviewNextIn: 'Lần ôn tiếp theo sau {days} ngày',
  reviewRetentionStrong: 'Bạn nhớ tốt!',
  reviewNeedsAttention: 'Cần ôn thêm',

  // Profile
  profileTitle: 'Hồ sơ',
  profileEdit: 'Chỉnh sửa hồ sơ',
  profileName: 'Họ và tên',
  profileEmail: 'Email',
  profilePhone: 'Số điện thoại',
  profileSchool: 'Trường',
  profileGrade: 'Lớp',
  profileTargetScore: 'Điểm mục tiêu',
  profileWeeklyHours: 'Thời gian học/tuần',
  profileJoined: 'Tham gia từ {date}',
  profileSave: 'Lưu thay đổi',
  profileSaved: 'Đã lưu!',

  // Competency
  competencyTitle: 'Mức độ thành thạo',
  competencyNotStudied: 'Chưa học',
  competencyInProgress: 'Đang học',
  competencyStudied: 'Đã học',
  competencyMastered: 'Đã thành thạo',
  competencyWeak: 'Cần củng cố',
  competencyStrong: 'Vững',

  // Progress
  progressTitle: 'Tiến độ',
  progressChapter: 'Chương {number}',
  progressLessonsCompleted: '{done}/{total} bài đã học',
  progressOverall: 'Tổng quan',
  progressThisWeek: 'Tuần này',

  // Session
  sessionDuration: '{minutes} phút',
  sessionPaused: 'Tạm dừng',
  sessionResume: 'Tiếp tục',
  sessionEnd: 'Kết thúc phiên',
} as const;

export type StudentMessages = typeof studentMessages;
