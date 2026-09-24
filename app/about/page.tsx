import type { Metadata } from 'next';

import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';

export const metadata: Metadata = {
  title: 'Về chúng tôi',
  description: 'Tìm hiểu về Tú Tài — nền tảng học tập cá nhân hóa cho học sinh lớp 12.',
};

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <PageHeader
        title="Về Tú Tài"
        description="Sứ mệnh, đội ngũ và câu chuyện đằng sau nền tảng học tập cá nhân hóa."
        className="mb-12"
      />
      <div className="space-y-8">
        <section>
          <h2 className="mb-4 text-xl font-semibold text-foreground">Sứ mệnh</h2>
          <Card>
            <CardContent className="p-6">
              <p className="text-muted-foreground leading-relaxed">
                Tú Tài ra đời với mục tiêu giúp học sinh lớp 12 học đúng chỗ, không lãng phí thời
                gian vào những gì đã vững, và được ôn luyện đúng trọng tâm trước kỳ thi tốt nghiệp
                THPT.
              </p>
            </CardContent>
          </Card>
        </section>
        <section>
          <h2 className="mb-4 text-xl font-semibold text-foreground">Đội ngũ</h2>
          <p className="text-muted-foreground leading-relaxed">
            Đội ngũ Tú Tài gồm các chuyên gia giáo dục, kỹ sư phần mềm và nhà thiết kế, tất cả cùng
            chia sẻ niềm tin rằng công nghệ có thể giúp việc học trở nên công bằng và hiệu quả hơn
            cho mọi học sinh.
          </p>
        </section>
      </div>
    </div>
  );
}
