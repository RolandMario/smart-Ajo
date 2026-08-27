"use client";

import { useState } from "react";
import html2canvas from "html2canvas";
import { Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Wraps the member-facing "share receipt" behaviour so the admin receipt page
 * can produce a shareable PNG too. Rendered by the server component next to
 * the receipt panel; captures that panel (via `html2canvas`) and hands it to
 * the browser's native share sheet. When the Web Share API isn't available
 * (or file sharing isn't supported) the image is downloaded instead.
 */

const RECEIPT_NODE_ID = "receipt-panel";

export function ShareReceiptButton({ reference }: { reference: string }) {
  const [preparing, setPreparing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function handleShare() {
    const node = document.getElementById(RECEIPT_NODE_ID);
    if (!node) {
      setNotice("Couldn't locate the receipt to share.");
      return;
    }

    setPreparing(true);
    setNotice(null);
    try {
      const canvas = await html2canvas(node as HTMLElement, {
        backgroundColor: "#ffffff",
        scale: 2,
        logging: false,
      });

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png"),
      );
      if (!blob) throw new Error("Couldn't render the receipt image.");

      const file = new File([blob], `ajo-receipt-${reference}.png`, {
        type: "image/png",
      });

      if (
        typeof navigator.share === "function" &&
        typeof navigator.canShare === "function" &&
        navigator.canShare({ files: [file] })
      ) {
        await navigator.share({
          files: [file],
          title: "Ajo transaction receipt",
          text: "Ajo bill payment receipt",
        });
      } else {
        // Fallback: no native share sheet (e.g. desktop Firefox) — download the
        // rendered receipt image so it can be shared manually.
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `ajo-receipt-${reference}.png`;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(url);
        setNotice(
          "Sharing isn't supported in this browser, so the receipt image was downloaded.",
        );
      }
    } catch (err: unknown) {
      // AbortError means the user dismissed the share sheet — not a failure.
      if (err instanceof Error && err.name === "AbortError") return;
      setNotice(err instanceof Error ? err.message : "Couldn't share the receipt.");
    } finally {
      setPreparing(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="secondary"
        onClick={handleShare}
        disabled={preparing}
      >
        <Share2 className="h-4 w-4" />
        {preparing ? "Preparing…" : "Share receipt"}
      </Button>
      {notice && <p className="max-w-[18rem] text-right text-xs text-ink-soft">{notice}</p>}
    </div>
  );
}