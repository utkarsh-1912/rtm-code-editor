const db = require('../src/db');
require('dotenv').config();

async function run() {
    console.log("Starting manual database initialization...");
    if (!process.env.DATABASE_URL) {
        console.error("ERROR: DATABASE_URL is not defined in environment variables.");
        process.exit(1);
    }

    await db.initializeSchema();
    console.log("Manual initialization complete.");
    process.exit(0);
}

run().catch(err => {
    console.error("Initialization Failed:", err);
    process.exit(1);
});
