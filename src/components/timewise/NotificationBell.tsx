
'use client';

import { Bell, X, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Notification } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';
import { ScrollArea } from '../ui/scroll-area';

interface NotificationBellProps {
  notifications: Notification[];
  onClearNotification: (id: string) => void;
  onClearAllNotifications: () => void;
}

export function NotificationBell({
  notifications,
  onClearNotification,
  onClearAllNotifications,
}: NotificationBellProps) {
  const notificationCount = notifications.length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-6 w-6" />
          {notificationCount > 0 && (
            <span className="absolute top-0 right-0 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white">
              {notificationCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="p-4 border-b">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold">Notifications</h3>
            {notificationCount > 0 && (
              <Button variant="link" size="sm" className="p-0 h-auto" onClick={onClearAllNotifications}>
                <Trash2 className="mr-1 h-3 w-3" />
                Clear all
              </Button>
            )}
          </div>
        </div>
        {notificationCount > 0 ? (
          <ScrollArea className="h-[280px]">
            <div className="divide-y">
              {notifications.map((notification) => (
                <div key={notification.id} className="p-4 flex items-start gap-3 hover:bg-muted/50">
                  <div className="flex-grow">
                    <p className="text-sm">{notification.message}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(notification.timestamp), { addSuffix: true })}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0"
                    onClick={() => onClearNotification(notification.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>
        ) : (
          <div className="p-8 text-center text-sm text-muted-foreground">
            You have no new notifications.
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
