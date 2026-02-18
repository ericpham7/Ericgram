// "import" = bring in code from another file/library so we can use it here
// "from" = specifies which library/file to import from
// { defineConfig } = "destructuring" — grabs just the defineConfig function out of the "vite" library
import { defineConfig } from "vite";

// This imports the React plugin for Vite
// Without this, Vite wouldn't know how to process .jsx files (React's HTML-in-JavaScript)
import react from "@vitejs/plugin-react";

// "export default" = makes this the main thing other files get when they import this file
// defineConfig() = a Vite helper that gives you autocomplete and type-checking for the config
export default defineConfig({
  // plugins: array of Vite plugins to use
  // react() = enables JSX transformation (converts <div> syntax into React.createElement("div"))
  plugins: [react()],

  // server: configuration for the Vite development server (what runs when you do "npm run dev")
  server: {
    // port: which port number to run on
    // You access the app at http://localhost:5176
    port: 5176,

    // proxy: URL forwarding rules
    // This is the BRIDGE between your React frontend and C++ backend
    proxy: {
      // "/api" = any request whose URL starts with /api will be forwarded
      "/api": {
        // target: WHERE to forward those requests to
        // Your C++ server listens on port 8080, so requests go there
        target: "http://localhost:8080",

        // changeOrigin: true = modifies the request's "Host" header to match the target
        // This makes the C++ server think the request came directly to it
        changeOrigin: true,
      },
    },
  },
});
