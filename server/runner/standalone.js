// Run the code runner as its own service: `npm run runner` (port RUNNER_PORT, default 5050).
// Point the web app at it with REACT_APP_RUNNER_URL=http://host:5050/api.
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { createRunnerRouter } = require("./router");
const { info } = require("./index");

const app = express();
app.use(cors({ origin: process.env.RUNNER_ALLOW_ORIGIN || "*" }));
app.get("/api/ping", (req, res) => res.json({ success: true, service: "runner" }));
app.use("/api", createRunnerRouter());

const port = Number(process.env.RUNNER_PORT) || 5050;
app.listen(port, () => {
    const { engines } = info();
    console.log(`Code runner listening on ${port} (engines: ${engines.join(", ") || "none configured"})`);
});
