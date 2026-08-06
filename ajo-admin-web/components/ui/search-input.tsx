"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";

/**
 * A search box that writes to the `search` URL param (debounced 350ms)
 * and resets `page` to 1 on every new query. Keeping search state in the
 * URL (rather than local component state lifted up) means the page stays
 * a Server Component that re-fetches on navigation, and search results
 * are shareable/bookmarkable/back-button-friendly.
 */
export function SearchInput({ placeholder }: { placeholder: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [value, setValue] = useState(searchParams.get("search") ?? "");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    return () => clearTimeout(debounceRef.current);
  }, []);

  function handleChange(next: string) {
    setValue(next);
    clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());

      if (next) {
        params.set("search", next);
      } else {
        params.delete("search");
      }
      params.delete("page");

      router.push(`${pathname}?${params.toString()}`);
    }, 350);
  }

  return (
    <Input
      type="search"
      value={value}
      onChange={(e) => handleChange(e.target.value)}
      placeholder={placeholder}
      className="max-w-xs"
      aria-label={placeholder}
    />
  );
}
