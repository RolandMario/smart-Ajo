import React, { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
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
import { ApiError } from "../../api/api-error";
import { listNotifications, markRead, markAllRead } from "../../api/notifications";
import type { AppNotification } from "../../types/api";
import { colors, radii, spacing, typography } from "../../theme";
import { formatDateTime } from "../../utils/format";

export function NotificationsScreen() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);

  async function fetchData() {
    try {
      const data = await listNotifications();
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
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
    }
  }

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchData();
    }, []),
  );

  async function handleMarkRead(notificationIds: string[]) {
    try {
      await markRead({ notificationIds });
      await fetchData();
    } catch {
      // Silently fail
    }
  }

  async function handleMarkAllRead() {
    setMarkingAll(true);
    try {
      await markAllRead();
      await fetchData();
    } catch {
      // Silently fail
    } finally {
      setMarkingAll(false);
    }
  }

  if (loading) return <LoadingScreen />;

  return (
    <Screen scrollable={false}>
      <View style={styles.header}>
        <Text style={styles.title}>Notifications</Text>
        {unreadCount > 0 && (
          <Button
            title="Mark all read"
            variant="ghost"
            onPress={handleMarkAllRead}
            loading={markingAll}
            style={styles.markAllButton}
          />
        )}
      </View>

      {error && <ErrorBanner message={error} />}

      {unreadCount > 0 && (
        <Text style={styles.unreadBadge}>
          {unreadCount} unread
        </Text>
      )}

      <FlatList
        data={notifications}
        keyExtractor={(item) => item._id}
        refreshing={refreshing}
        onRefresh={() => {
          setRefreshing(true);
          fetchData();
        }}
        contentContainerStyle={styles.list}
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: colors.ink,
  },
  markAllButton: {
    minHeight: undefined,
    paddingHorizontal: spacing.sm,
  },
  unreadBadge: {
    fontSize: typography.sizes.sm,
    color: colors.primary,
    fontWeight: typography.weights.medium,
    marginBottom: spacing.md,
  },
  list: {
    flexGrow: 1,
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
    color: colors.ink,
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    fontSize: typography.sizes.base,
    color: colors.inkSoft,
    textAlign: "center",
  },
  notifCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  notifUnread: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
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
    backgroundColor: colors.primary,
  },
  notifBody: {
    flex: 1,
  },
  notifTitle: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
    marginBottom: spacing.xs,
  },
  notifBodyText: {
    fontSize: typography.sizes.sm,
    color: colors.inkSoft,
    lineHeight: 20,
    marginBottom: spacing.xs,
  },
  notifTime: {
    fontSize: typography.sizes.xs,
    color: colors.inkFaint,
  },
});