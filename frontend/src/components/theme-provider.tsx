"use client";

// Re-export next-themes so the rest of the app imports from one place.
// next-themes handles SSR correctly, disables transitions during switch,
// and exposes resolvedTheme ("dark" | "light") — no more manual class juggling.
export { ThemeProvider } from "next-themes";
export { useTheme } from "next-themes";
