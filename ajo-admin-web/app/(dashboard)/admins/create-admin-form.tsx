"use client";

import { useActionState, useRef, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { createAdminAction, type CreateAdminActionResult } from "@/lib/data/admin-actions";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

const initialState: CreateAdminActionResult = {};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Creating…" : "Create admin"}
    </Button>
  );
}

export function CreateAdminForm() {
  const [state, formAction] = useActionState(createAdminAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  // Clear the form on success — the new admin shows up in the list below
  // via revalidatePath, so there's nothing more for this form to do.
  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
    }
  }, [state.success]);

  return (
    <Card className="p-6">
      <h2 className="font-display text-lg font-semibold text-ink mb-1">Create admin</h2>
      <p className="text-sm text-ink-soft mb-5">
        New accounts can sign in to this console immediately with the password set below.
      </p>

      <form ref={formRef} action={formAction} className="space-y-4 max-w-md">
        <div>
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" type="text" autoComplete="name" placeholder="Optional" />
        </div>

        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="admin@ajo.app"
          />
        </div>

        <div>
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" name="phone" type="tel" required placeholder="+2348012345678" />
          <p className="text-xs text-ink-soft mt-1">E.164 format, e.g. +2348012345678.</p>
        </div>

        <div>
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            placeholder="At least 8 characters"
          />
        </div>

        {state.error && (
          <p role="alert" className="text-sm text-danger">
            {state.error}
          </p>
        )}
        {state.success && (
          <p role="status" className="text-sm text-success">
            Admin account created.
          </p>
        )}

        <SubmitButton />
      </form>
    </Card>
  );
}
