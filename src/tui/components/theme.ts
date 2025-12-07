/**
 * Unified Theme for TUI
 */

export const theme = {
  colors: {
    primary: "cyan",
    accent: "magenta",
    success: "green",
    warning: "yellow",
    error: "red",
    muted: "gray",
    text: "white",
    title: "cyan",
  },
  borders: {
    focused: "double" as const,
    unfocused: "single" as const,
    overlay: "round" as const,
  },
};
