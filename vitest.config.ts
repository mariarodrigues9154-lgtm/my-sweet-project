import { defineConfig } from "vitest/config";

// Unit tests exercise handlers without TanStack's RPC build transformation.
export default defineConfig({
  resolve: { alias: { "@": new URL("./src", import.meta.url).pathname } },
  test: { environment: "node" },
});