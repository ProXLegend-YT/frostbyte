import { useEffect } from "react";

/**
 * Registers global keyboard shortcuts for the app. Centralized here (rather
 * than scattered addEventListener calls in individual components) so the
 * full set of shortcuts is visible in one place and easy to extend without
 * hunting through the component tree.
 *
 * Shortcuts intentionally avoid single letter keys (like just "n" or "/")
 * without a modifier, since that would fire while someone is typing in the
 * chat composer or a settings field — every shortcut here requires
 * Cmd/Ctrl so it never collides with normal typing.
 */
export function useKeyboardShortcuts({ onNewChat, onFocusSearch, onEscape }) {
  useEffect(() => {
    function handleKeyDown(e) {
      const mod = e.metaKey || e.ctrlKey;

      // Cmd/Ctrl+K -> new chat (matches the common convention used by most
      // chat-style apps, including Claude's own web interface)
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onNewChat?.();
        return;
      }

      // Cmd/Ctrl+/ -> focus the sidebar search box
      if (mod && e.key === "/") {
        e.preventDefault();
        onFocusSearch?.();
        return;
      }

      // Escape -> let individual components decide what "close" means right
      // now (dismiss a modal, close the mobile sidebar, blur an input, etc).
      // Deliberately does NOT preventDefault, so it doesn't block Escape's
      // other native behaviors (e.g. cancelling text selection).
      if (e.key === "Escape") {
        onEscape?.();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onNewChat, onFocusSearch, onEscape]);
}
