import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    env: {
      VITE_TURNSTILE_SITE_KEY: "1x00000000000000000000AA",
    },
    include: [
      "src/features/containment/**/*.test.ts",
      "src/features/whitelist/**/*.test.ts",
      "src/features/fcfs/**/*.test.ts",
      "src/features/wallet-checker/**/*.test.ts",
    ],
  },
});
