import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/lib/{analytics,csv,date,validation}.ts"],
      thresholds: { lines: 85, functions: 85, statements: 85, branches: 75 },
    },
  },
});
