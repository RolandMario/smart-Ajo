import React, { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Screen } from "../../components/Screen";
import { Button } from "../../components/Button";
import { ErrorBanner } from "../../components/ErrorBanner";
import { LoadingScreen } from "../../components/LoadingScreen";
import { Pagination } from "../../components/Pagination";
import { SubpageHeader } from "../../components/SubpageHeader";
import type { AccountStackParamList } from "../../navigation/types";
import { ApiError } from "../../api/api-error";
import {
  NOTIFICATION_PAGE_SIZE,
  listNotificationPage,
  markAllRead,
  markRead,
} from "../../api/notifications";
import type { AppNotification } from "../../types/api";
import { colors, radii, spacing, typography } from "../../theme";
import { formatDateTime } from "../../utils/format";

type Props = NativeStackScreenProps<AccountStackParamList, "Notifications">;

/**
 * Alerts inbox — opened from the avatar chip in the top-right of every tab
 * root (it used to be a tab, so it now carries a back chip). Rows are paged
 * 10 at a time by the server; marking rows read keeps the current page.
 */
export function NotificationsScreen({ navigation }: Props) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [paging, setPaging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);

  /** Loads one page of the inbox (10 rows) and keeps the pager in sync. */
  const loadPage = useCallback(async (targetPage: number, showSpinner = false) => {
    if (showSpinner) setLoading(true);
    setPaging(true);
    try {
      const data = await listNotificationPage(targetPage);
      // The requested page may no longer exist (rows cleared elsewhere) —
      // fall back to the last page the server actually has.
      const lastPage = Math.max(1, Math.ceil(data.total / NOTIFICATION_PAGE_SIZE));
      if (targetPage > lastPage) {
        const clamped = await listNotificationPage(lastPage);
        setNotifications(clamped.notifications);
        setUnreadCount(clamped.unreadCount);
        setTotal(clamped.total);
        setPage(lastPage);
      } else {
        setNotifications(data.notifications);
        setUnreadCount(data.unreadCount);
        setTotal(data.total);
        setPage(targetPage);
      }
      setError(null);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to load notifications");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
      setPaging(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadPage(1, true);
    }, [loadPage]),
  );

  async function handleMarkRead(notificationIds: string[]) {
    try {
      await markRead({ notificationIds });
      await loadPage(page);
    } catch {
      // Silently fail
    }
  }

  async function handleMarkAllRead() {
    setMarkingAll(true);
    try {
      await markAllRead();
      await loadPage(page);
    } catch {
      // Silently fail
    } finally {
      setMarkingAll(false);
    }
  }

  if (loading) return <LoadingScreen />;

  const pageCount = Math.max(1, Math.ceil(total / NOTIFICATION_PAGE_SIZE));

  return (
    <Screen scrollable={false}>
      <SubpageHeader
        title="Alerts"
        subtitle={unreadCount > 0 ? `${unreadCount} unread` : undefined}
        onBack={() => navigation.goBack()}
        right={
          unreadCount > 0 ? (
            <Button
              title="Mark all read"
              variant="ghost"
              onPress={handleMarkAllRead}
              loading={markingAll}
              style={styles.markAllButton}
            />
          ) : undefined
        }
      />

      {error && <ErrorBanner message={error} />}

      <FlatList
        data={notifications}
        keyExtractor={(item) => item._id}
        refreshing={refreshing}
        onRefresh={() => {
          setRefreshing(true);
          void loadPage(1);
        }}
        contentContainerStyle={styles.list}
        style={styles.listBox}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No notifications</Text>
            <Text style={styles.emptySubtitle}>
              {`You'll see updates about your groups here.`}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            style={[
              styles.notifCard,
              !item.isRead && styles.notifUnread,
            ]}
            onPress={() => {
              if (!item.isRead) {
                handleMarkRead([item._id]);
              }
            }}
          >
            <View style={styles.notifContent}>
              <View style={styles.notifDot}>
                {!item.isRead && <View style={styles.unreadDot} />}
              </View>
              <View style={styles.notifBody}>
                <Text style={styles.notifTitle}>{item.title}</Text>
                <Text style={styles.notifBodyText} numberOfLines={2}>
                  {item.body}
                </Text>
                <Text style={styles.notifTime}>
                  {formatDateTime(item.createdAt)}
                </Text>
              </View>
            </View>
          </Pressable>
        )}
      />

      <Pagination
        page={page}
        pageCount={pageCount}
        total={total}
        pageSize={NOTIFICATION_PAGE_SIZE}
        loading={paging}
        onChange={(next) => {
          void loadPage(next);
        }}
        style={styles.pagination}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  markAllButton: {
    minHeight: undefined,
    paddingHorizontal: spacing.sm,
  },
  list: {
    flexGrow: 1,
  },
  listBox: {
    flex: 1,
  },
  pagination: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: spacing.xxxl * 2,
  },
  emptyTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.forestLightInk,
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    fontSize: typography.sizes.base,
    color: colors.forestLightInkSoft,
    textAlign: "center",
  },
  notifCard: {
    backgroundColor: colors.white,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.forestLightLine,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  notifUnread: {
    borderColor: colors.forestAction,
    backgroundColor: colors.forestLightPill,
  },
  notifContent: {
    flexDirection: "row",
  },
  notifDot: {
    width: 20,
    alignItems: "center",
    paddingTop: 4,
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.forestAction,
  },
  notifBody: {
    flex: 1,
  },
  notifTitle: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.forestLightInk,
    marginBottom: spacing.xs,
  },
  notifBodyText: {
    fontSize: typography.sizes.sm,
    color: colors.forestLightInkSoft,
    lineHeight: 20,
    marginBottom: spacing.xs,
  },
  notifTime: {
    fontSize: typography.sizes.xs,
    color: colors.forestLightInkFaint,
  },
});