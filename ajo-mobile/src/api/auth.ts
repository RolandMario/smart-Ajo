import { apiFetch } from "./client";
import { authedFetch } from "./authed-client";
import type { AuthUser, OtpRequestResponse, OtpVerifyResponse, UpdateProfilePayload } from "../types/api";

export async function requestOtp(phone: string): Promise<OtpRequestResponse> {
  return apiFetch<OtpRequestResponse>("/auth/otp/request", {
    method: "POST",
    body: { phone },
  });
}

export async function verifyOtp(phone: string, code: string): Promise<OtpVerifyResponse> {
  return apiFetch<OtpVerifyResponse>("/auth/otp/verify", {
    method: "POST",
    body: { phone, code },
  });
}

export async function registerNewUser(phone: string, email: string, password: string): Promise<{ message: string; userId: string }> {
  return apiFetch<{ message: string; userId: string }>("/auth/register", {
    method: "POST",
    body: { phone, email, password },
  });
}

export async function loginWithPassword(phone: string, password: string): Promise<OtpVerifyResponse> {
  return apiFetch<OtpVerifyResponse>("/auth/login", {
    method: "POST",
    body: { phone, password },
  });
}

export async function forgotPassword(phone: string): Promise<{ message: string }> {
  return apiFetch<{ message: string }>("/auth/forgot-password", {
    method: "POST",
    body: { phone },
  });
}

export async function resetPassword(phone: string, code: string, newPassword: string): Promise<{ message: string }> {
  return apiFetch<{ message: string }>("/auth/reset-password", {
    method: "POST",
    body: { phone, code, newPassword },
  });
}

export async function fetchCurrentUser(): Promise<AuthUser> {
  return authedFetch<AuthUser>("/auth/me");
}

export async function updateProfile(dto: UpdateProfilePayload): Promise<AuthUser> {
  return authedFetch<AuthUser>("/auth/me", {
    method: "PATCH",
    body: dto,
  });
}