import { build } from "esbuild";

const common = { bundle: true, format: "esm", sourcemap: true, logLevel: "warning" };
await build({ ...common, entryPoints: ["src/manifest.ts"], outdir: "dist", platform: "node", target: "node22", external: ["@paperclipai/plugin-sdk"] });
await build({ ...common, entryPoints: ["src/worker.ts"], outdir: "dist", platform: "node", target: "node22", external: ["@paperclipai/plugin-sdk", "react", "react-dom"] });
await build({
  ...common,
  entryPoints: ["src/ui/index.tsx"],
  outdir: "dist/ui",
  platform: "browser",
  target: "es2022",
  jsx: "automatic",
  external: ["@paperclipai/plugin-sdk/ui", "@paperclipai/plugin-sdk/ui/hooks", "react", "react-dom", "react/jsx-runtime"],
});
console.log("built dist/");
