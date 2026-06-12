import { buildApp } from "./app.js";

const PORT = process.env.PORT || 3030;

const startServer = async () => {
  const { server } = await buildApp();
  server.listen(PORT, () => console.log(`✅ Server listening on port ${PORT}`));
};

startServer().catch((err) => {
  console.error("❌ Failed to start server:", err);
});
