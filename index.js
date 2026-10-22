const express = require("express");
const logger = require("morgan");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const dataLoader = require("./lib/dataLoader");
const { STATE_NAMES } = require("./lib/filters");
const openApiSpec = require("./lib/openapi-spec");
const { apiRateLimit } = require("./lib/rateLimit");
const v1Router = require("./routes/v1/index.js");
const v2Router = require("./routes/v2/index.js");
const systemRouter = require("./routes/system");

const app = express();

// Get port from command line args, environment, or default to 3000
const PORT = process.argv[2] || process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || "development";

app.set("port", PORT);
app.set("env", NODE_ENV);
app.disable("x-powered-by");
// Vercel sits as exactly one proxy in front of the app and sets X-Forwarded-For itself.
// Trusting only that hop makes req.ip the client address without letting clients spoof it.
app.set("trust proxy", 1);

app.use(cors());
app.use(logger("tiny"));

// Serve static files (favicon); the index page is rendered below
app.use(express.static(path.join(__dirname, "public"), { index: false }));

// Index page: public/index.html with the available years filled in
const years = dataLoader.getAvailableYears();
const currentYear = new Date().getFullYear();
const exampleYear = years.includes(currentYear) ? currentYear : years[years.length - 1];
const icalLinks = Object.entries(STATE_NAMES)
  .map(([code, name]) => `                <a href="webcal://schulferien-api.de/api/v2/ical/${code}.ics" class="btn">${name}</a>`)
  .join("\n");
const homePage = fs
  .readFileSync(path.join(__dirname, "public", "index.html"), "utf8")
  .replaceAll("{{YEAR_RANGE}}", `${years[0]}–${years[years.length - 1]}`)
  .replaceAll("{{YEARS}}", years.join(", "))
  .replaceAll("{{YEAR_COUNT}}", String(years.length))
  .replaceAll("{{EXAMPLE_YEAR}}", String(exampleYear))
  .replaceAll("{{ICAL_LINKS}}", icalLinks)
  .replaceAll("{{COPYRIGHT_YEARS}}", `2022–${currentYear}`);

app.get("/", (req, res) => {
  res.set("Cache-Control", "public, max-age=3600, s-maxage=86400");
  res.type("html").send(homePage);
});

// Swagger UI, loaded from a CDN so nothing has to be served from node_modules on Vercel
const SWAGGER_UI_VERSION = "5.17.14";

app.get("/docs/openapi.json", (req, res) => {
  res.json(openApiSpec);
});

app.get("/docs", (req, res) => {
  res.type("html").send(`<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>API Dokumentation | Deutsche Schulferien API</title>
    <meta name="color-scheme" content="light">
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@${SWAGGER_UI_VERSION}/swagger-ui.css">
    <style>body { margin: 0; background: #fff; }</style>
</head>
<body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@${SWAGGER_UI_VERSION}/swagger-ui-bundle.js"></script>
    <script>
        SwaggerUIBundle({ url: "/docs/openapi.json", dom_id: "#swagger-ui" });
    </script>
</body>
</html>`);
});

// Holiday data only changes with a deployment (which purges the Vercel CDN cache),
// so API responses can be cached at the edge. Time-dependent v2 endpoints override this.
app.use("/api", (req, res, next) => {
  res.set("Cache-Control", "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800");
  next();
});

app.use("/api", apiRateLimit());

app.use("/api/v1", v1Router);
app.use("/api/v2", v2Router);
app.use("/", systemRouter);

// Simple HTML page for 404s and errors outside the API
const renderMessagePage = (title, message) => `<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} | Deutsche Schulferien API</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #fff; color: #000; text-align: center; padding: 2rem;
            min-height: 100vh; display: flex; align-items: center; justify-content: center;
        }
        .container {
            max-width: 500px; border: 1px solid #000; padding: 3rem 2rem;
            position: relative; background: #fff;
        }
        .container::before {
            content: ''; position: absolute; top: -1px; left: -1px;
            right: -1px; bottom: -1px; background: #000; z-index: -1;
            transform: translate(6px, 6px);
        }
        h1 { font-size: 2rem; margin-bottom: 2rem; font-weight: 300; }
        p { margin-bottom: 2rem; color: #666; }
        a {
            display: inline-block; padding: 1rem 2rem; background: #000;
            color: #fff; text-decoration: none; border: 1px solid #000;
            transition: all 0.2s ease;
        }
        a:hover { background: #fff; color: #000; }
    </style>
</head>
<body>
    <div class="container">
        <h1>${title}</h1>
        <p>${message}</p>
        <a href="/">Startseite</a>
        <a href="/docs">API Dokumentation</a>
    </div>
</body>
</html>`;

// 404 handler
app.use((req, res) => {
  res.status(404);

  if (req.path.startsWith("/api")) {
    res.json({
      error: {
        message: `API endpoint ${req.method} ${req.path} not found`,
        statusCode: 404,
        documentation: "/docs",
      },
    });
  } else {
    res.send(renderMessagePage("404", "Die angeforderte Seite existiert nicht."));
  }
});

// Error handler
app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500;

  // Only expected client errors are shown verbatim; internals (paths, stack) stay in the logs
  if (status >= 500) {
    console.error(err);
  }
  const message = status < 500 ? err.message : "Internal server error";

  res.status(status);
  if (status >= 500) {
    res.set("Cache-Control", "no-store");
  }

  if (req.path.startsWith("/api")) {
    res.json({
      error: {
        message,
        statusCode: status,
        documentation: "/docs",
      },
    });
  } else {
    res.send(renderMessagePage("Ein Fehler ist aufgetreten", "Bitte versuchen Sie es später erneut."));
  }
});

// Export app for Vercel and tests
module.exports = app;

// Only listen when started directly (node index.js), not when imported
if (require.main === module && !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(
      `Express Server started on Port ${app.get(
        "port"
      )} | Environment : ${app.get("env")}`
    );
  });
}
