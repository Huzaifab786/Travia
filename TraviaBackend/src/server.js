const http = require("http");
const dotenv = require("dotenv");
dotenv.config();

const app = require("./app");
const { initSocket } = require("./socket");

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);
initSocket(server);

server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 TraviaBackend running on http://0.0.0.0:${PORT}`);
});