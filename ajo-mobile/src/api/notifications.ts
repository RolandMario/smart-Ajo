import { authedFetch } from "./authed-client";
import type {
  NotificationListResponse,
  MarkReadPayload,
  RegisterDeviceTokenPayload,
} from "../types/api";

export async function listNotifications(
  limit?: number,
  skip?: number,
): Promise<NotificationListResponse> {
  const params = new URLSearchParams();
  if (limit !== undefined) params.set("limit", String(limit));
  if (skip !== undefined) params.set("skip", String(skip));
  const qs = params.toString();
  return authedFetch<NotificationListResponse>(`/notifications${qs ? `?${qs}` : ""}`);
}

export async function markRead(dto: MarkReadPayload): Promise<void> {
  return authedFetch<void>("/notifications/read", {
    method: "PATCH",
    body: dto,
  });
}

export async function markAllRead(): Promise<void> {
  return authedFetch<void>("/notifications/read-all", {
    method: "PATCH",
  });
}

export async function registerDeviceToken(dto: RegisterDeviceTokenPayload): Promise<void> {
  return authedFetch<void>("/notifications/device-token", {
    method: "POST",
    body: dto,
  });
}

export async function deactivateDeviceToken(token: string): Promise<void> {
  return authedFetch<void>(`/notifications/device-token/${token}`, {
    method: "DELETE",
  });
}