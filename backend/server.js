const express = require("express");
const path = require("path");
const session = require("express-session");

const apiRoutes = require("./routes/apiRoutes");
const { notFoundHandler, errorHandler } = require("./middleware/errorMiddleware");

const FRONTEND_DIST_PATH = path.join(__dirname, "..", "frontend", "dist");

function createApp() {
  const app = express();

  // CORS configuration for cross-origin requests
  app.use((req, res, next) => {
    const allowedOrigins = [
      "https://mepc-energy-news-updates.vercel.app",
      "https://mepc-energy-news-updates.vercel.app/",
      "http://localhost:5173",
      "http://localhost:3000"
    ];
    const origin = req.headers.origin;
    // Allow if origin is in allowed list OR if it's a same-origin request (no origin header)
    if (allowedOrigins.includes(origin) || !origin) {
      res.setHeader("Access-Control-Allow-Origin", origin || "*");
    }
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(
    session({
      secret: process.env.SESSION_SECRET || "replace-this-session-secret-in-production",
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
        maxAge: 1000 * 60 * 60 * 8
      }
    })
  );

  app.use("/api", apiRoutes);
  app.use("/api", notFoundHandler);

  app.use(express.static(FRONTEND_DIST_PATH));

  app.get("*", (req, res) => {
    res.sendFile(path.join(FRONTEND_DIST_PATH, "index.html"));
  });

  app.use(errorHandler);
  return app;
}

function startServer(port = process.env.PORT || 3000) {
  const app = createApp();
  return app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
  });
}

if (require.main === module) {
  startServer();
}

module.exports = {
  createApp,
  startServer
};
