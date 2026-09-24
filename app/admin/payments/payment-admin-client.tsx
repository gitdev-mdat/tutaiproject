'use client';

import { useState, useTransition, useCallback } from 'react';
import { PlusOrder } from '@/lib/db/payment-types';
import {
  adminConfirmPaymentAction,
  adminRejectPaymentAction,
  adminCancelPaymentAction,
  adminReopenPaymentAction,
} from './actions';
import { Clock, Search, MoreHorizontal, CheckCircle, XCircle, Ban, XOctagon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';

type FilterType = 'ALL' | 'PENDING' | 'PAID' | 'REJECTED' | 'CANCELLED';

export function PaymentAdminClient({ initialOrders }: { initialOrders: PlusOrder[] }) {
  const [filter, setFilter] = useState<FilterType>('ALL');
  const [search, setSearch] = useState('');
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const [toasts, setToasts] = useState<
    { id: number; message: string; type: 'success' | 'error' }[]
  >([]);
  const pushToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  const [selectedOrder, setSelectedOrder] = useState<PlusOrder | null>(null);
  const [actionType, setActionType] = useState<'CONFIRM' | 'REJECT' | 'CANCEL' | 'REOPEN' | null>(
    null
  );
  const [rejectReason, setRejectReason] = useState('');

  const displayedOrders = initialOrders
    .filter((o) => {
      if (filter === 'PENDING')
        return o.status === 'PENDING_PAYMENT' || o.status === 'PAYMENT_REVIEW';
      if (filter === 'PAID') return o.status === 'PAID';
      if (filter === 'REJECTED') return o.status === 'REJECTED';
      if (filter === 'CANCELLED') return o.status === 'CANCELLED';
      return true;
    })
    .filter((o) => {
      if (!search) return true;
      const s = search.toLowerCase();
      return o.code.toLowerCase().includes(s) || o.userId.toLowerCase().includes(s);
    });

  const openDialog = (order: PlusOrder, type: 'CONFIRM' | 'REJECT' | 'CANCEL' | 'REOPEN') => {
    setSelectedOrder(order);
    setActionType(type);
    setRejectReason('');
  };

  const closeDialog = () => {
    setSelectedOrder(null);
    setActionType(null);
  };

  const handleConfirmAction = () => {
    if (!selectedOrder) return;
    const type = actionType;
    const orderCode = selectedOrder.code;
    const reason = rejectReason;
    closeDialog();

    startTransition(async () => {
      try {
        if (type === 'CONFIRM') {
          await adminConfirmPaymentAction(orderCode);
          pushToast('Đã xác nhận thanh toán. Tài khoản học sinh đã được kích hoạt Tú Tài Plus.');
        } else if (type === 'REJECT') {
          await adminRejectPaymentAction(orderCode, reason);
          pushToast('Đã từ chối giao dịch.');
        } else if (type === 'CANCEL') {
          await adminCancelPaymentAction(orderCode);
          pushToast('Đã hủy đơn hàng.');
        } else if (type === 'REOPEN') {
          await adminReopenPaymentAction(orderCode);
          pushToast('Đã đưa giao dịch về chờ xử lý.');
        }
        router.refresh();
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : '';
        if (message.includes('xử lý')) {
          pushToast('Giao dịch đã được xử lý trước đó.', 'error');
        } else {
          pushToast(message || 'Không thể cập nhật giao dịch. Vui lòng thử lại.', 'error');
        }
        router.refresh();
      }
    });
  };

  const getStatusBadge = (status: string) => {
    if (status === 'PAID')
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-[#e4f3ed] text-[#08a985]">
          Đã thanh toán
        </span>
      );
    if (status === 'PENDING_PAYMENT' || status === 'PAYMENT_REVIEW')
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-[#fef3c7] text-[#d97706]">
          Chờ thanh toán
        </span>
      );
    if (status === 'REJECTED')
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-[#fee2e2] text-[#ef4444]">
          Từ chối
        </span>
      );
    if (status === 'CANCELLED')
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-500">
          Đã hủy
        </span>
      );
    return (
      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-500">
        {status}
      </span>
    );
  };

  return (
    <div className="bg-white rounded-2xl shadow-[0_4px_20px_rgb(0,0,0,0.04)] border border-gray-100 overflow-hidden relative">
      {toasts.length > 0 && (
        <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`px-4 py-3 rounded-lg shadow-lg text-sm font-medium flex items-center gap-2 ${t.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}
            >
              {t.type === 'success' ? <CheckCircle size={18} /> : <XOctagon size={18} />}
              {t.message}
            </div>
          ))}
        </div>
      )}

      {/* Toolbar */}
      <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between bg-gray-50/50">
        <div className="flex flex-wrap bg-gray-100/80 p-1 rounded-lg gap-1">
          <button
            onClick={() => setFilter('ALL')}
            className={`px-4 py-2 rounded-md text-sm font-bold transition-colors ${filter === 'ALL' ? 'bg-white text-[#0a1628] shadow-sm' : 'text-gray-500 hover:text-[#0a1628]'}`}
          >
            Tất cả
          </button>
          <button
            onClick={() => setFilter('PENDING')}
            className={`px-4 py-2 rounded-md text-sm font-bold transition-colors flex items-center gap-1.5 ${filter === 'PENDING' ? 'bg-white text-[#d97706] shadow-sm' : 'text-gray-500 hover:text-[#d97706]'}`}
          >
            Chờ thanh toán
          </button>
          <button
            onClick={() => setFilter('PAID')}
            className={`px-4 py-2 rounded-md text-sm font-bold transition-colors ${filter === 'PAID' ? 'bg-white text-[#08a985] shadow-sm' : 'text-gray-500 hover:text-[#08a985]'}`}
          >
            Đã thanh toán
          </button>
          <button
            onClick={() => setFilter('REJECTED')}
            className={`px-4 py-2 rounded-md text-sm font-bold transition-colors ${filter === 'REJECTED' ? 'bg-white text-[#ef4444] shadow-sm' : 'text-gray-500 hover:text-[#ef4444]'}`}
          >
            Từ chối
          </button>
          <button
            onClick={() => setFilter('CANCELLED')}
            className={`px-4 py-2 rounded-md text-sm font-bold transition-colors ${filter === 'CANCELLED' ? 'bg-white text-gray-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Đã hủy
          </button>
        </div>

        <div className="relative w-full md:w-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            placeholder="Tìm mã đơn, học sinh..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#0052ff] w-full md:w-64"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-white border-b border-gray-100 text-xs text-gray-400 font-bold uppercase tracking-wider">
              <th className="px-6 py-4">Mã đơn</th>
              <th className="px-6 py-4">Ngày tạo</th>
              <th className="px-6 py-4">Gói</th>
              <th className="px-6 py-4">Phương thức</th>
              <th className="px-6 py-4">Số tiền</th>
              <th className="px-6 py-4">Trạng thái</th>
              <th className="px-6 py-4 text-center w-16">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {displayedOrders.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-gray-500 text-sm">
                  Không tìm thấy giao dịch nào.
                </td>
              </tr>
            ) : (
              displayedOrders.map((order) => {
                const isPendingState =
                  order.status === 'PENDING_PAYMENT' || order.status === 'PAYMENT_REVIEW';
                const isRowProcessing = isPending && selectedOrder?.id === order.id;

                const hasActions = isPendingState || order.status === 'REJECTED';

                return (
                  <tr
                    key={order.id}
                    className={`hover:bg-gray-50/50 transition-colors ${isRowProcessing ? 'opacity-50 pointer-events-none' : ''}`}
                  >
                    <td className="px-6 py-4">
                      <span className="font-bold text-[#0a1628]">{order.code}</span>
                      <div className="text-xs text-gray-400 mt-1">User: {order.userId}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {new Date(order.createdAt).toLocaleString('vi-VN')}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-700">
                      {order.planId === 'PLUS_6M' ? '6 tháng' : '12 tháng'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {order.paymentMethod === 'BANK_TRANSFER' ? 'Chuyển khoản' : 'MoMo'}
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-medium text-gray-900">
                        {order.amount.toLocaleString('vi-VN')}đ
                      </span>
                    </td>
                    <td className="px-6 py-4">{getStatusBadge(order.status)}</td>
                    <td className="px-6 py-4 text-center">
                      {!hasActions ? (
                        <span className="text-gray-300">—</span>
                      ) : (
                        <DropdownMenu>
                          <DropdownMenuTrigger>
                            <Button
                              variant="ghost"
                              className="h-8 w-8 p-0"
                              disabled={isRowProcessing}
                            >
                              <span className="sr-only">Mở menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-[200px]">
                            {isPendingState && (
                              <>
                                <DropdownMenuItem onClick={() => openDialog(order, 'CONFIRM')}>
                                  <CheckCircle className="mr-2 h-4 w-4 text-green-600" />
                                  Xác nhận thanh toán
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => openDialog(order, 'REJECT')}>
                                  <Ban className="mr-2 h-4 w-4 text-red-500" />
                                  Từ chối giao dịch
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => openDialog(order, 'CANCEL')}>
                                  <XCircle className="mr-2 h-4 w-4 text-gray-500" />
                                  Hủy đơn
                                </DropdownMenuItem>
                              </>
                            )}

                            {order.status === 'REJECTED' && (
                              <>
                                <DropdownMenuItem onClick={() => openDialog(order, 'REOPEN')}>
                                  <Clock className="mr-2 h-4 w-4 text-amber-500" />
                                  Đưa về chờ xử lý
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Confirmation Dialogs */}
      <Dialog open={!!actionType} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              {actionType === 'CONFIRM' && 'Xác nhận thanh toán'}
              {actionType === 'REJECT' && 'Từ chối giao dịch'}
              {actionType === 'CANCEL' && 'Hủy đơn hàng?'}
              {actionType === 'REOPEN' && 'Đưa về chờ xử lý?'}
            </DialogTitle>
            <DialogDescription>
              {actionType === 'CONFIRM' && (
                <>
                  Bạn đang xác nhận giao dịch <strong>{selectedOrder?.code}</strong> đã được thanh
                  toán. Sau khi xác nhận, tài khoản học sinh sẽ được kích hoạt Tú Tài Plus.
                </>
              )}
              {actionType === 'REJECT' && (
                <>
                  Bạn đang từ chối giao dịch <strong>{selectedOrder?.code}</strong>.
                </>
              )}
              {actionType === 'CANCEL' && (
                <>
                  Đơn <strong>{selectedOrder?.code}</strong> sẽ được đánh dấu là đã hủy. Thao tác
                  này không kích hoạt gói Plus.
                </>
              )}
              {actionType === 'REOPEN' && (
                <>
                  Giao dịch <strong>{selectedOrder?.code}</strong> sẽ được đưa về trạng thái chờ xử
                  lý lại.
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {actionType === 'CONFIRM' && selectedOrder && (
            <div className="py-4 space-y-2 text-sm bg-gray-50 p-4 rounded-lg my-2 border border-gray-100">
              <div className="flex justify-between">
                <span className="text-gray-500">Mã đơn</span>
                <span className="font-medium text-gray-900">{selectedOrder.code}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Học sinh</span>
                <span className="font-medium text-gray-900">{selectedOrder.userId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Gói</span>
                <span className="font-medium text-gray-900">
                  {selectedOrder.planId === 'PLUS_6M' ? '6 tháng' : '12 tháng'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Số tiền</span>
                <span className="font-bold text-[#0052ff]">
                  {selectedOrder.amount.toLocaleString('vi-VN')}đ
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Phương thức</span>
                <span className="font-medium text-gray-900">
                  {selectedOrder.paymentMethod === 'BANK_TRANSFER' ? 'Chuyển khoản' : 'MoMo'}
                </span>
              </div>
            </div>
          )}

          {actionType === 'REJECT' && (
            <div className="py-4">
              <Textarea
                placeholder="Ví dụ: Không tìm thấy giao dịch chuyển khoản tương ứng..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="resize-none h-24"
              />
            </div>
          )}

          <DialogFooter className="mt-4 gap-2 sm:gap-0">
            <Button variant="outline" onClick={closeDialog} disabled={isPending}>
              Hủy
            </Button>
            <Button
              onClick={handleConfirmAction}
              disabled={isPending || (actionType === 'REJECT' && !rejectReason.trim())}
              className={
                actionType === 'REJECT' || actionType === 'CANCEL'
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : actionType === 'CONFIRM'
                    ? 'bg-[#0052ff] hover:bg-[#0047df] text-white'
                    : ''
              }
            >
              {isPending
                ? 'Đang xử lý...'
                : actionType === 'CONFIRM'
                  ? 'Xác nhận thanh toán'
                  : actionType === 'REJECT'
                    ? 'Từ chối'
                    : actionType === 'CANCEL'
                      ? 'Hủy đơn'
                      : 'Xác nhận'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
