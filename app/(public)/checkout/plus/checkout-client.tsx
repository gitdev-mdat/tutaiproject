'use client';

import { useState, useTransition } from 'react';
import { useSearchParams } from 'next/navigation';
import { PaymentMethod, PLUS_PLANS, PlusSubscription } from '@/lib/db/payment-types';
import { createCheckoutOrderAction } from './actions';
import { Building2, Wallet, Copy, Check, ShieldCheck, QrCode } from 'lucide-react';

export function CheckoutClient({
  planParam,
}: {
  planParam: string;
  existingSub: PlusSubscription | null;
}) {
  const searchParams = useSearchParams();
  const returnUrl = searchParams?.get('returnUrl') || '';

  const [selectedPlanId, setSelectedPlanId] = useState<string>(
    PLUS_PLANS[planParam] ? planParam : 'PLUS_6M'
  );

  const [prevPlanParam, setPrevPlanParam] = useState(planParam);
  if (planParam !== prevPlanParam) {
    setPrevPlanParam(planParam);
    if (PLUS_PLANS[planParam]) {
      setSelectedPlanId(planParam);
    }
  }

  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('BANK_TRANSFER');
  const [isPending, startTransition] = useTransition();

  const [copiedAccount, setCopiedAccount] = useState(false);
  const [copiedContent, setCopiedContent] = useState(false);

  const plan = PLUS_PLANS[selectedPlanId];

  const fakePaymentContent = `TUTAI PLUS ${selectedPlanId === 'PLUS_6M' ? '6M' : '12M'} NM123`;
  const bankQrUrl = `https://img.vietqr.io/image/mb-0968689102-compact.png?amount=${plan.price}&addInfo=${encodeURIComponent(fakePaymentContent)}&accountName=NGUYEN%20MINH%20DAT`;

  const handleCreateOrder = () => {
    startTransition(async () => {
      await createCheckoutOrderAction(selectedPlanId, selectedMethod, returnUrl);
    });
  };

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

  return (
    <div className="max-w-[1180px] mx-auto text-[#0a1628]">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold mb-1">Nâng cấp Tú Tài Plus</h1>
        <p className="text-sm text-gray-500">Hoàn tất thanh toán để mở khóa toàn bộ quyền lợi.</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Left Column: 52% */}
        <div className="lg:w-[52%] flex flex-col gap-6">
          <section>
            <h2 className="text-lg font-bold mb-4">Gói thời gian</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label
                className={`relative flex flex-col p-4 border-2 rounded-xl cursor-pointer transition-all duration-200 ${
                  selectedPlanId === 'PLUS_6M'
                    ? 'border-[#0052ff] bg-[#f2f8ff] shadow-[0_4px_14px_rgba(0,82,255,0.1)]'
                    : 'border-gray-200 hover:border-[#0052ff]/40 bg-white'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="font-bold text-[15px]">6 tháng</div>
                  <div
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                      selectedPlanId === 'PLUS_6M' ? 'border-[#0052ff]' : 'border-gray-300'
                    }`}
                  >
                    {selectedPlanId === 'PLUS_6M' && (
                      <div className="w-2.5 h-2.5 rounded-full bg-[#0052ff]" />
                    )}
                  </div>
                </div>
                <div className="flex-1 flex flex-col justify-end">
                  <div
                    className={`font-bold text-lg ${selectedPlanId === 'PLUS_6M' ? 'text-[#0052ff]' : 'text-[#0a1628]'}`}
                  >
                    349.000đ
                  </div>
                  <div className="text-[13px] text-gray-500">≈ 58.000đ / tháng</div>
                </div>
                <input
                  type="radio"
                  name="plan"
                  value="PLUS_6M"
                  className="hidden"
                  checked={selectedPlanId === 'PLUS_6M'}
                  onChange={() => setSelectedPlanId('PLUS_6M')}
                />
              </label>

              <label
                className={`relative flex flex-col p-4 border-2 rounded-xl cursor-pointer transition-all duration-200 ${
                  selectedPlanId === 'PLUS_12M'
                    ? 'border-[#0052ff] bg-[#f2f8ff] shadow-[0_4px_14px_rgba(0,82,255,0.1)]'
                    : 'border-gray-200 hover:border-[#0052ff]/40 bg-white'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="font-bold text-[15px]">12 tháng</div>
                  <div
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                      selectedPlanId === 'PLUS_12M' ? 'border-[#0052ff]' : 'border-gray-300'
                    }`}
                  >
                    {selectedPlanId === 'PLUS_12M' && (
                      <div className="w-2.5 h-2.5 rounded-full bg-[#0052ff]" />
                    )}
                  </div>
                </div>
                <div className="mb-2">
                  <span className="text-[11px] font-bold text-[#08a985] bg-[#e4f3ed] px-2 py-1 rounded-md inline-block uppercase tracking-wide">
                    Tiết kiệm 99.000đ
                  </span>
                </div>
                <div className="flex-1 flex flex-col justify-end">
                  <div
                    className={`font-bold text-lg ${selectedPlanId === 'PLUS_12M' ? 'text-[#0052ff]' : 'text-[#0a1628]'}`}
                  >
                    599.000đ
                  </div>
                  <div className="text-[13px] text-gray-500">≈ 50.000đ / tháng</div>
                </div>
                <input
                  type="radio"
                  name="plan"
                  value="PLUS_12M"
                  className="hidden"
                  checked={selectedPlanId === 'PLUS_12M'}
                  onChange={() => setSelectedPlanId('PLUS_12M')}
                />
              </label>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3">Phương thức thanh toán</h2>
            <div className="grid grid-cols-1 gap-2.5">
              <label
                className={`flex items-center p-3.5 border-2 rounded-xl cursor-pointer transition-all duration-200 ${
                  selectedMethod === 'BANK_TRANSFER'
                    ? 'border-[#0052ff] bg-[#f2f8ff] shadow-[0_4px_14px_rgba(0,82,255,0.1)]'
                    : 'border-gray-200 hover:border-[#0052ff]/40 bg-white'
                }`}
              >
                <div className="flex items-center gap-3 flex-1">
                  <div className="w-9 h-9 bg-white border border-gray-100 rounded-lg flex items-center justify-center text-[#0052ff] shadow-sm">
                    <Building2 size={18} />
                  </div>
                  <span className="font-bold text-[14px]">Chuyển khoản ngân hàng</span>
                </div>
                <div
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                    selectedMethod === 'BANK_TRANSFER' ? 'border-[#0052ff]' : 'border-gray-300'
                  }`}
                >
                  {selectedMethod === 'BANK_TRANSFER' && (
                    <div className="w-2.5 h-2.5 rounded-full bg-[#0052ff]" />
                  )}
                </div>
                <input
                  type="radio"
                  name="method"
                  className="hidden"
                  checked={selectedMethod === 'BANK_TRANSFER'}
                  onChange={() => setSelectedMethod('BANK_TRANSFER')}
                />
              </label>

              <label
                className={`flex items-center p-3.5 border-2 rounded-xl cursor-pointer transition-all duration-200 ${
                  selectedMethod === 'MOMO'
                    ? 'border-[#a50064] bg-[#fff5fa] shadow-[0_4px_14px_rgba(165,0,100,0.1)]'
                    : 'border-gray-200 hover:border-[#a50064]/40 bg-white'
                }`}
              >
                <div className="flex items-center gap-3 flex-1">
                  <div className="w-9 h-9 bg-white border border-[#fcecf3] rounded-lg flex items-center justify-center text-[#a50064] shadow-sm">
                    <Wallet size={18} />
                  </div>
                  <span className="font-bold text-[14px]">MoMo</span>
                </div>
                <div
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                    selectedMethod === 'MOMO' ? 'border-[#a50064]' : 'border-gray-300'
                  }`}
                >
                  {selectedMethod === 'MOMO' && (
                    <div className="w-2.5 h-2.5 rounded-full bg-[#a50064]" />
                  )}
                </div>
                <input
                  type="radio"
                  name="method"
                  className="hidden"
                  checked={selectedMethod === 'MOMO'}
                  onChange={() => setSelectedMethod('MOMO')}
                />
              </label>
            </div>
          </section>
        </div>

        {/* Right Column: 48% */}
        <div className="lg:w-[48%]">
          {/* Premium Payment Bill Card */}
          <div className="bg-white rounded-[24px] shadow-[0_12px_40px_rgb(0,0,0,0.08)] border border-[#e8f1ff] p-7 relative overflow-hidden ring-1 ring-[#0052ff]/5">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-[#0052ff] to-[#08a985]"></div>

            {/* 1. Header */}
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-lg">Hóa đơn thanh toán</h3>
              <span className="bg-[#e4f3ed] text-[#08a985] text-xs font-bold px-2.5 py-1 rounded-md inline-flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#08a985] animate-pulse"></span>
                Sẵn sàng
              </span>
            </div>

            {/* 2. Product Summary Row */}
            <div className="bg-[#f8fbff] rounded-xl px-4 py-3 border border-[#e8f1ff] flex justify-between items-center mb-6">
              <div className="flex items-center gap-2">
                <span className="font-bold text-[#0052ff]">Tú Tài Plus</span>
                <span className="text-gray-300">•</span>
                <span className="text-sm font-medium text-gray-600">
                  {plan.durationMonths} tháng
                </span>
              </div>
              <div className="font-bold text-[17px] text-[#0a1628]">
                {plan.price.toLocaleString('vi-VN')}đ
              </div>
            </div>

            {/* 3. Main Payment Content Row (2 Columns on Desktop) */}
            <div className="flex flex-col md:flex-row gap-5 mb-6">
              {/* Left Side: QR */}
              <div className="flex flex-col items-center shrink-0">
                <div className="w-[180px] h-[180px] bg-white border border-gray-100 rounded-[18px] shadow-sm flex items-center justify-center p-2 mb-2 relative group">
                  {selectedMethod === 'BANK_TRANSFER' ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={bankQrUrl} alt="Bank QR" className="w-full h-full object-contain" />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-[#fff5fa] border border-dashed border-[#fbcce0] rounded-xl text-[#a50064]">
                      <QrCode size={40} strokeWidth={1.5} className="mb-2 opacity-50" />
                      <span className="font-medium text-[13px]">MoMo QR</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-[16px] flex items-center justify-center">
                    <span className="text-white text-xs font-medium bg-black/40 px-3 py-1.5 rounded-full backdrop-blur-sm">
                      Quét mã
                    </span>
                  </div>
                </div>
                <p className="text-[12px] text-gray-500 font-medium">Quét mã để thanh toán nhanh</p>
              </div>

              {/* Right Side: Payment Details */}
              <div className="flex-1 flex flex-col justify-between">
                <div className="bg-white border border-gray-100 rounded-xl shadow-sm divide-y divide-gray-50 flex-1 flex flex-col">
                  {selectedMethod === 'BANK_TRANSFER' ? (
                    <>
                      <div className="px-3 py-2.5 flex justify-between items-center text-[13px]">
                        <span className="text-gray-500">Ngân hàng</span>
                        <span className="font-bold">MB Bank</span>
                      </div>
                      <div className="px-3 py-2.5 flex justify-between items-center text-[13px]">
                        <span className="text-gray-500">Chủ tài khoản</span>
                        <span className="font-bold truncate max-w-[120px]" title="NGUYEN MINH DAT">
                          NGUYEN MINH DAT
                        </span>
                      </div>
                      <div className="px-3 py-2.5 flex justify-between items-center text-[13px]">
                        <span className="text-gray-500">Số tài khoản</span>
                        <span className="font-bold">0968689102</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="px-3 py-2.5 flex justify-between items-center text-[13px]">
                        <span className="text-gray-500">Ví điện tử</span>
                        <span className="font-bold text-[#a50064]">MoMo</span>
                      </div>
                      <div className="px-3 py-2.5 flex justify-between items-center text-[13px]">
                        <span className="text-gray-500">Người nhận</span>
                        <span className="font-bold truncate max-w-[120px]" title="Nguyen Minh Dat">
                          Nguyen Minh Dat
                        </span>
                      </div>
                      <div className="px-3 py-2.5 flex justify-between items-center text-[13px]">
                        <span className="text-gray-500">Số điện thoại</span>
                        <span className="font-bold">0968689102</span>
                      </div>
                    </>
                  )}

                  <div className="px-3 pt-2.5 pb-3 bg-gray-50/50 flex flex-col gap-1.5 rounded-b-xl flex-1 justify-center">
                    <span className="text-gray-500 text-[12px]">Nội dung CK (bắt buộc)</span>
                    <div className="font-bold text-[#0052ff] tracking-wide text-sm bg-white border border-gray-200 px-2 py-1.5 rounded-lg text-center shadow-inner">
                      {fakePaymentContent}
                    </div>
                  </div>
                </div>

                {/* Compact Copy Buttons */}
                <div className="grid grid-cols-2 gap-2 mt-3">
                  <button
                    onClick={() => handleCopy('0968689102', 'account')}
                    className="flex items-center justify-center gap-1.5 text-[12px] font-bold text-gray-600 bg-gray-50 hover:bg-gray-100 border border-gray-200 py-2 rounded-lg transition-colors"
                  >
                    {copiedAccount ? (
                      <Check size={14} className="text-[#08a985]" />
                    ) : (
                      <Copy size={14} />
                    )}
                    {copiedAccount
                      ? 'Đã chép'
                      : selectedMethod === 'BANK_TRANSFER'
                        ? 'Chép STK'
                        : 'Chép SĐT'}
                  </button>
                  <button
                    onClick={() => handleCopy(fakePaymentContent, 'content')}
                    className="flex items-center justify-center gap-1.5 text-[12px] font-bold text-[#0052ff] bg-[#f2f8ff] hover:bg-[#e6f0ff] border border-[#d1e3ff] py-2 rounded-lg transition-colors"
                  >
                    {copiedContent ? <Check size={14} /> : <Copy size={14} />}
                    {copiedContent ? 'Đã chép' : 'Chép nội dung'}
                  </button>
                </div>
              </div>
            </div>

            {/* 4. CTA Block */}
            <div className="flex flex-col gap-3 border-t border-gray-100 pt-5">
              <button
                onClick={handleCreateOrder}
                disabled={isPending}
                className="w-full bg-[#0052ff] hover:bg-[#0047df] text-white font-bold py-3.5 rounded-xl transition-all shadow-[0_4px_14px_rgba(0,82,255,0.3)] hover:shadow-[0_6px_20px_rgba(0,82,255,0.4)] disabled:opacity-50 disabled:cursor-not-allowed text-[15px]"
              >
                {isPending ? 'Đang xử lý...' : 'Tôi đã thanh toán'}
              </button>

              <div className="flex justify-center gap-4 text-[11px] text-gray-400 font-medium">
                <div className="flex items-center gap-1">
                  <ShieldCheck size={12} /> An toàn
                </div>
                <div className="flex items-center gap-1">
                  <Check size={12} /> Xác nhận thủ công
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
