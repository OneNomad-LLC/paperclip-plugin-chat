import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";

const manifest: PaperclipPluginManifestV1 = {
  id: "onenomad-chat",
  apiVersion: 1,
  version: "0.1.0",
  displayName: "Chat",
  description: "Chat directly with any agent without opening a task. Conversations keep context and replies stream in.",
  author: "OneNomad",
  categories: ["ui"],
  capabilities: [
    "agents.read",
    "agent.sessions.create",
    "agent.sessions.list",
    "agent.sessions.send",
    "agent.sessions.close",
    "plugin.state.read",
    "plugin.state.write",
    "ui.page.register",
    "ui.sidebar.register",
  ],
  entrypoints: {
    worker: "./dist/worker.js",
    ui: "./dist/ui",
  },
  ui: {
    slots: [
      { type: "page", id: "chat-page", displayName: "Chat", exportName: "ChatPage", routePath: "chat" },
      { type: "sidebar", id: "chat-nav", displayName: "Chat", exportName: "ChatNavLink", order: 15 },
    ],
  },
};

export default manifest;
