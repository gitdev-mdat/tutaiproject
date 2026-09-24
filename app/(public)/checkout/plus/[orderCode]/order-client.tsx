'use client';

import { useState, useTransition, useEffect } from 'react';
import { PlusOrder } from '@/lib/db/payment-types';
import { markPaymentUnderReviewAction } from './actions';
import { Copy, Check, Clock, AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { PAYMENT_CONFIG } from '@/config/payment';

export function OrderClient({ order }: { order: PlusOrder }) {
  const [copiedAccount, setCopiedAccount] = useState(false);
  const [copiedContent, setCopiedContent] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [localStatus, setLocalStatus] = useState(order.status);

  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (!order.expiresAt) return;
    const expiresAt = new Date(order.expiresAt).getTime();

    const tick = () => {
      const now = new Date().getTime();
      const diff = Math.max(0, Math.floor((expiresAt - now) / 1000));
      setTimeLeft(diff);
      if (diff === 0 && localStatus === 'PENDING_PAYMENT') {
        setLocalStatus('EXPIRED');
      }
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [order.expiresAt, localStatus]);

  const handleCopy = (text: string, type: 'account' | 'content') => {
    navigator.clipboard.writeText(text);
    if (type === 'account') {
      setCopiedAccount(true);
      setTimeout(() => setCopiedAccount(false), 2000);
    } else {
      setCopiedContent(true);
      setTimeout(() => setCopiedContent(false), 2000);
    }
  };

  const handleMarkReview = () => {
    startTransition(async () => {
      await markPaymentUnderReviewAction(order.code);
      setLocalStatus('PAYMENT_REVIEW');
      router.refresh();
    });
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const bankQrUrl = PAYMENT_CONFIG.bank.qrTemplate
    .replace('{amount}', order.amount.toString())
    .replace('{content}', order.code.replace('-', ' '));

  if (localStatus === 'EXPIRED') {
    return (
      <div className="max-w-[1100px] mx-auto flex items-center justify-center py-20">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-[#0a1628] mb-2">Đơn thanh toán đã hết hạn</h2>
          <p className="text-gray-500 mb-8">Vui lòng tạo đơn mới để tiếp tục nâng cấp Plus.</p>
          <button
            onClick={() => router.push('/pricing')}
            className="bg-[#0052ff] hover:bg-[#0047df] text-white font-bold py-3 px-8 rounded-xl transition-colors"
          >
            Tạo đơn mới
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1100px] mx-auto text-[#0a1628]">
      <div className="flex flex-col lg:flex-row gap-10">
        {/* Left Column: 60% */}
        <div className="lg:w-3/5 flex flex-col gap-6">
          <h1 className="text-3xl font-extrabold mb-2">
            {order.paymentMethod === 'BANK_TRANSFER'
              ? 'Thanh toán qua ngân hàng'
              : 'Thanh toán qua MoMo'}
          </h1>

          <div className="bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-gray-100 p-8 flex flex-col items-center">
            <div className="text-sm text-gray-500 mb-2 font-medium">Số tiền cần thanh toán</div>
            <div className="text-5xl font-bold text-[#0052ff] mb-8 tracking-tight">
              {order.amount.toLocaleString('vi-VN')}đ
            </div>

            {order.paymentMethod === 'BANK_TRANSFER' ? (
              <div className="flex flex-col items-center w-full">
                {/* QR Code */}
                <div className="w-[240px] h-[240px] bg-white border border-gray-200 rounded-2xl mb-8 flex items-center justify-center p-2 overflow-hidden shadow-sm">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={bankQrUrl} alt="VietQR" className="w-full h-full object-contain" />
                </div>

                {/* Details */}
                <div className="w-full max-w-md flex flex-col gap-4 text-sm bg-[#f8fbff] rounded-xl p-6 border border-[#e8f1ff]">
                  <div className="flex justify-between border-b border-[#d1e3ff] pb-3">
                    <span className="text-gray-500">Ngân hàng</span>
                    <span className="font-bold text-[#0a1628]">{PAYMENT_CONFIG.bank.bankName}</span>
                  </div>
                  <div className="flex justify-between border-b border-[#d1e3ff] pb-3">
                    <span className="text-gray-500">Chủ tài khoản</span>
                    <span className="font-bold text-[#0a1628]">
                      {PAYMENT_CONFIG.bank.accountName}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-[#d1e3ff] pb-3 items-center">
                    <span className="text-gray-500">Số tài khoản</span>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[#0a1628] text-base">
                        {PAYMENT_CONFIG.bank.accountNumber}
                      </span>
                      <button
                        onClick={() => handleCopy(PAYMENT_CONFIG.bank.accountNumber, 'account')}
                        className="text-[#0052ff] hover:bg-[#d1e3ff] p-1.5 rounded-md transition-colors"
                        title="Sao chép"
                      >
                        {copiedAccount ? <Check size={16} /> : <Copy size={16} />}
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 pt-2">
                    <span className="text-gray-500">Nội dung chuyển khoản</span>
                    <div className="flex justify-between items-center bg-white border border-[#d1e3ff] rounded-lg py-2 px-3">
                      <span className="font-extrabold text-[#0052ff] text-xl tracking-widest">
                        {order.code.replace('-', ' ')}
                      </span>
                      <button
                        onClick={() => handleCopy(order.code.replace('-', ' '), 'content')}
                        className="text-[#0052ff] bg-[#f0f6ff] hover:bg-[#d1e3ff] py-1.5 px-3 rounded-md transition-colors font-medium flex items-center gap-1.5"
                        title="Sao chép"
                      >
                        {copiedContent ? <Check size={16} /> : <Copy size={16} />}
                        {copiedContent ? 'Đã chép' : 'Sao chép'}
                      </button>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      Vui lòng giữ nguyên số tiền và nội dung chuyển khoản để Tú Tài xác định đúng
                      đơn hàng.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center w-full">
                {/* QR Code Placeholder for MoMo */}
                <div className="w-[240px] h-[240px] bg-white border border-[#fcecf3] rounded-2xl mb-8 flex items-center justify-center p-2 shadow-sm text-[#a50064] text-sm">
                  [ MoMo QR ]
                </div>

                <div className="w-full max-w-md flex flex-col gap-4 text-sm bg-[#fff5fa] rounded-xl p-6 border border-[#fcecf3]">
                  <div className="flex justify-between border-b border-[#fbcce0] pb-3">
                    <span className="text-gray-500">Người nhận</span>
                    <span className="font-bold text-[#0a1628]">
                      {PAYMENT_CONFIG.momo.receiverName}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-[#fbcce0] pb-3 items-center">
                    <span className="text-gray-500">Số điện thoại MoMo</span>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[#0a1628] text-base">
                        {PAYMENT_CONFIG.momo.phoneNumber}
                      </span>
                      <button
                        onClick={() => handleCopy(PAYMENT_CONFIG.momo.phoneNumber, 'account')}
                        className="text-[#a50064] hover:bg-[#fbcce0] p-1.5 rounded-md transition-colors"
                        title="Sao chép"
                      >
                        {copiedAccount ? <Check size={16} /> : <Copy size={16} />}
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 pt-2">
                    <span className="text-gray-500">Nội dung chuyển tiền</span>
                    <div className="flex justify-between items-center bg-white border border-[#fbcce0] rounded-lg py-2 px-3">
                      <span className="font-extrabold text-[#a50064] text-xl tracking-widest">
                        {order.code.replace('-', ' ')}
                      </span>
                      <button
                        onClick={() => handleCopy(order.code.replace('-', ' '), 'content')}
                        className="text-[#a50064] bg-[#fff5fa] hover:bg-[#fbcce0] py-1.5 px-3 rounded-md transition-colors font-medium flex items-center gap-1.5"
                        title="Sao chép"
                      >
                        {copiedContent ? <Check size={16} /> : <Copy size={16} />}
                        {copiedContent ? 'Đã chép' : 'Sao chép'}
                      </button>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      Vui lòng điền đúng lời nhắn chuyển tiền để đơn hàng được duyệt tự động.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: 40% */}
        <div className="lg:w-2/5">
          <div className="bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-gray-100 p-6 sm:p-8 sticky top-24">
            <h3 className="text-xs font-bold text-gray-400 tracking-wider mb-6">ĐƠN HÀNG</h3>

            <div className="flex justify-between items-start mb-6">
              <div>
                <div className="font-bold text-xl">Tú Tài Plus</div>
                <div className="text-sm text-gray-500 mt-1">
                  {order.planId === 'PLUS_6M' ? '6 tháng' : '12 tháng'}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-4 text-sm mb-6">
              <div className="flex justify-between">
                <span className="text-gray-500">Mã đơn</span>
                <strong className="text-[#0a1628]">{order.code}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Trạng thái</span>
                {localStatus === 'PENDING_PAYMENT' && (
                  <strong className="text-[#d97706]">Chờ thanh toán</strong>
                )}
                {localStatus === 'PAYMENT_REVIEW' && (
                  <strong className="text-[#0052ff]">Đang xác nhận</strong>
                )}
              </div>
            </div>

            <div className="h-px bg-gray-100 w-full my-6"></div>

            {localStatus === 'PENDING_PAYMENT' ? (
              <>
                <div className="flex items-center justify-between text-sm text-gray-500 mb-6 bg-gray-50 p-3 rounded-lg border border-gray-100">
                  <span className="flex items-center gap-2">
                    <Clock size={16} /> Hiệu lực trong
                  </span>
                  <span className="font-bold text-[#0a1628]">
                    {timeLeft !== null ? formatTime(timeLeft) : '--:--'}
                  </span>
                </div>

                <p className="text-xs text-gray-500 text-center mb-4">
                  Sau khi chuyển tiền, hãy nhấn nút bên dưới để Tú Tài kiểm tra giao dịch.
                </p>
                <button
                  onClick={handleMarkReview}
                  disabled={isPending}
                  className="w-full bg-[#0052ff] hover:bg-[#0047df] text-white font-bold py-4 rounded-xl transition-colors disabled:opacity-50"
                >
                  {isPending ? 'Đang xử lý...' : 'Tôi đã chuyển tiền'}
                </button>
              </>
            ) : (
              <div className="text-center bg-[#f2f8ff] p-6 rounded-xl border border-[#d1e3ff]">
                <Clock className="w-10 h-10 text-[#0052ff] mx-auto mb-3" />
                <h3 className="font-bold text-lg text-[#0052ff] mb-2">Đang xác nhận giao dịch</h3>
                <p className="text-sm text-[#0052ff]/80">
                  Tú Tài đang kiểm tra thanh toán của em. Gói Plus sẽ được kích hoạt ngay khi nhận
                  được tiền.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
