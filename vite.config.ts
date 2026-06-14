import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

<<<<<<< HEAD
/** Production base path. Default `/` for custom domain (blackwater-labs.com). Override for subpath deploys. */
const deployBase = process.env.VITE_BASE_PATH
  ? process.env.VITE_BASE_PATH.endsWith("/")
    ? process.env.VITE_BASE_PATH
    : `${process.env.VITE_BASE_PATH}/`
  : "/";
=======
const deployBase = "/";
>>>>>>> 14fff33938409c0429335ca96f76ca5541246093

export default defineConfig(({ command }) => ({
  base: command === "build" ? deployBase : "/",
  plugins: [
    react(),
    command === "serve" && {
      name: "dev-html-entry",
      configureServer(server) {
        server.middlewares.use((req, _res, next) => {
          const path = req.url?.split("?")[0];
          if (path === "/" || path === "/index.html") {
            req.url = "/index.vite.html";
          }
          next();
        });
      },
    },
  ].filter(Boolean),
 build: {
  rollupOptions: {
    input: resolve(__dirname, "index.html"),
  },
},
}));
