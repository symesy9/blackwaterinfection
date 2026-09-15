import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: [
      "src/features/containment/**/*.test.ts",
      "src/features/whitelist/**/*.test.ts",
      "src/features/fcfs/**/*.test.ts",
      "src/features/wallet-checker/**/*.test.ts",
    ],
  },
});
