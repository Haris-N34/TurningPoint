"use client";

import { useEffect, type RefObject } from "react";

// Keyboard focus trap for modal dialogs (aria-modal="true"). Tab and Shift+Tab cycle inside the dialog,
// focus that lands outside (a click on the backdrop, a Tab from the page) is pulled back in, Escape calls
// onEscape, and focus returns to where it was when the dialog closes.

const FOCUSABLE = 'a[href],area[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"]),[contenteditable="true"],audio[controls],video[controls]';

export function focusables(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => !el.closest("[inert]") && el.getClientRects().length > 0);
}

/** Where Tab should go next, or undefined to let the browser move focus normally. */
export function nextFocus(list: HTMLElement[], active: Element | null, shift: boolean): HTMLElement | undefined {
  if (!list.length) return undefined;
  const i = active ? list.indexOf(active as HTMLElement) : -1;
  if (i === -1) return shift ? list[list.length - 1] : list[0];
  if (shift && i === 0) return list[list.length - 1];
  if (!shift && i === list.length - 1) return list[0];
  return undefined;
}

export function useFocusTrap(ref: RefObject<HTMLElement | null>, active = true, onEscape?: () => void) {
  useEffect(() => {
    const root = ref.current;
    if (!active || !root) return;
    const before = document.activeElement as HTMLElement | null;
    if (!root.contains(document.activeElement)) (focusables(root)[0] ?? root).focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && onEscape) {
        e.preventDefault();
        onEscape();
        return;
      }
      if (e.key !== "Tab") return;
      const target = nextFocus(focusables(root), root.contains(document.activeElement) ? document.activeElement : null, e.shiftKey);
      if (target) {
        e.preventDefault();
        target.focus();
      }
    };
    const onFocusIn = (e: FocusEvent) => {
      if (e.target instanceof Node && !root.contains(e.target)) (focusables(root)[0] ?? root).focus({ preventScroll: true });
    };
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("focusin", onFocusIn);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("focusin", onFocusIn);
      if (before?.isConnected) before.focus({ preventScroll: true });
    };
  }, [ref, active, onEscape]);
}
