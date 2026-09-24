'use client';

import * as React from 'react';
import { Popover } from '@base-ui/react/popover';
import { Bell, X } from 'lucide-react';
import { useStudentShell } from './student-shell';

/** Page-level notification control; intentionally not a global horizontal header. */
export function StudentNotificationBell() {
  const { model } = useStudentShell();
  const { notifications } = model;
  const [notificationsOpen, setNotificationsOpen] = React.useState(false);
  const [readIds, setReadIds] = React.useState(
    () =>
      new Set(
        notifications
          .filter((notification) => notification.read)
          .map((notification) => notification.id)
      )
  );
  const unreadCount = notifications.filter((notification) => !readIds.has(notification.id)).length;

  const handleNotificationActivate = (id: string) => {
    setReadIds((current) => new Set(current).add(id));
  };

  return (
    <Popover.Root open={notificationsOpen} onOpenChange={setNotificationsOpen}>
      <Popover.Trigger
        aria-haspopup="true"
        aria-controls="student-notifications-panel"
        aria-label={`Xem thông báo${unreadCount > 0 ? ` (${unreadCount} chưa đọc)` : ''}`}
        className="relative flex h-10 w-10 items-center justify-center rounded-full border border-[#E2E9F3] bg-white text-slate-500 shadow-[0_5px_18px_rgba(15,23,42,0.05)] transition-all hover:-translate-y-px hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span
            aria-hidden="true"
            className="absolute -right-0.5 -top-0.5 flex h-2 w-2 rounded-full bg-red-500 ring-[1.5px] ring-white"
          />
        )}
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Positioner
          align="end"
          side="bottom"
          sideOffset={8}
          collisionPadding={16}
          className="isolate z-[100] outline-none"
        >
          <Popover.Popup
            id="student-notifications-panel"
            aria-label="Thông báo"
            className="w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-slate-200 bg-white p-2 shadow-xl outline-none"
          >
            <div className="flex items-center justify-between px-2 py-1">
              <p className="text-[13px] font-bold text-slate-500">Thông báo</p>
              <Popover.Close
                aria-label="Đóng thông báo"
                className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <X size={14} />
              </Popover.Close>
            </div>
            {notifications.length === 0 ? (
              <p className="px-3 py-4 text-center text-[13px] text-slate-400">
                Không có thông báo mới
              </p>
            ) : (
              <ul className="flex flex-col">
                {notifications.map((notification) => {
                  const read = readIds.has(notification.id);
                  return (
                    <li key={notification.id}>
                      <button
                        type="button"
                        onClick={() => handleNotificationActivate(notification.id)}
                        aria-label={
                          read
                            ? `${notification.title} (đã đọc)`
                            : `${notification.title} (chưa đọc, nhấn để đánh dấu đã đọc)`
                        }
                        className="flex w-full flex-col items-start gap-0.5 rounded-xl px-3 py-2 text-left transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <div className="flex items-center gap-2">
                          {!read && (
                            <span
                              aria-hidden="true"
                              className="h-1.5 w-1.5 rounded-full bg-blue-500"
                            />
                          )}
                          <span className="text-[13px] font-semibold text-slate-700">
                            {notification.title}
                          </span>
                        </div>
                        <span className="text-[12px] text-slate-500">
                          {notification.description}
                        </span>
                        <span className="text-[11px] text-slate-400">{notification.timestamp}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
