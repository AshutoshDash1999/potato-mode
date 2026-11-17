import { defineConfig } from "wxt";

// See https://wxt.dev/api/reference/wxt/interfaces/inlineconfig.html
export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  manifest: {
    name: "Potato Mode",
    description:
      "Turn your fast computer into a potato: throttle network and CPU, switch off JS or CSS, and see what it does to a page.",
    permissions: [
      "debugger",
      "contentSettings",
      "storage",
      "tabs",
      "scripting",
    ],
    host_permissions: ["<all_urls>"],
    // No default_popup: clicking the toolbar icon toggles the in-page panel.
    action: {
      default_title: "Toggle Potato Mode",
    },
  },
});
