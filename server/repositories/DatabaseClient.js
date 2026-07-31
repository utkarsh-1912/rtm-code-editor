const { neon } = require('@neondatabase/serverless');
require('dotenv').config();

const sql = neon(process.env.DATABASE_URL);

/**
 * Initialize core Postgres schemas if missing
 */
async function initializeSchema() {
    try {
        console.log("Checking and initializing database schema...");

        await sql`
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            email VARCHAR(255) UNIQUE NOT NULL,
            name VARCHAR(255),
            auth_provider_id VARCHAR(255) UNIQUE NOT NULL,
            is_unsubscribed BOOLEAN DEFAULT FALSE,
            bio TEXT DEFAULT '',
            social_links JSONB DEFAULT '{}'::jsonb,
            last_room_id VARCHAR(255),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        `;

        await sql`
        CREATE TABLE IF NOT EXISTS rooms (
            id SERIAL PRIMARY KEY,
            room_id VARCHAR(255) UNIQUE NOT NULL,
            code TEXT,
            language VARCHAR(50) DEFAULT 'javascript',
            chat_history JSONB DEFAULT '[]'::jsonb,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        `;

        await sql`
        CREATE TABLE IF NOT EXISTS user_rooms (
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            room_id VARCHAR(255) REFERENCES rooms(room_id) ON DELETE CASCADE,
            joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (user_id, room_id)
        );
        `;

        await sql`
        CREATE TABLE IF NOT EXISTS organizations (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        `;

        await sql`
        CREATE TABLE IF NOT EXISTS organization_members (
            org_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            role VARCHAR(50) DEFAULT 'member',
            joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (org_id, user_id)
        );
        `;

        await sql`
        CREATE TABLE IF NOT EXISTS snippets (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            organization_id INTEGER REFERENCES organizations(id) ON DELETE SET NULL,
            title VARCHAR(255) NOT NULL,
            code TEXT NOT NULL,
            language VARCHAR(50) NOT NULL,
            tags JSONB DEFAULT '[]'::jsonb,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        `;

        await sql`
        CREATE TABLE IF NOT EXISTS notifications (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            type VARCHAR(50) NOT NULL,
            message TEXT NOT NULL,
            data JSONB DEFAULT '{}'::jsonb,
            read BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        `;

        await sql`
        CREATE TABLE IF NOT EXISTS sessions (
            id SERIAL PRIMARY KEY,
            user_id VARCHAR(255) NOT NULL,
            device VARCHAR(255),
            ip VARCHAR(255),
            user_agent TEXT,
            session_id VARCHAR(255) UNIQUE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            last_active TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        `;

        await sql`
        CREATE TABLE IF NOT EXISTS projects (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            name VARCHAR(255) NOT NULL,
            description TEXT DEFAULT '',
            type VARCHAR(50) DEFAULT 'web',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        `;

        await sql`
        CREATE TABLE IF NOT EXISTS project_files (
            id SERIAL PRIMARY KEY,
            project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
            name VARCHAR(255) NOT NULL,
            path VARCHAR(500) NOT NULL,
            content TEXT DEFAULT '',
            is_directory BOOLEAN DEFAULT FALSE,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(project_id, path)
        );
        `;

        await sql`
        CREATE TABLE IF NOT EXISTS snapshots (
            id SERIAL PRIMARY KEY,
            project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
            room_id VARCHAR(255),
            name VARCHAR(255) NOT NULL,
            code TEXT,
            files_snapshot JSONB DEFAULT '[]'::jsonb,
            created_by VARCHAR(255) DEFAULT 'User',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        `;

        await sql`
        CREATE TABLE IF NOT EXISTS analytics_logs (
            id SERIAL PRIMARY KEY,
            user_id VARCHAR(255),
            room_id VARCHAR(255),
            project_id INTEGER,
            action_type VARCHAR(100) NOT NULL,
            metadata JSONB DEFAULT '{}'::jsonb,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        `;

        await sql`
        CREATE TABLE IF NOT EXISTS workspace_permissions (
            id SERIAL PRIMARY KEY,
            room_id VARCHAR(255),
            project_id INTEGER,
            user_id VARCHAR(255) NOT NULL,
            can_edit BOOLEAN DEFAULT TRUE,
            can_share BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        `;

        // Ensure missing columns exist for backward compatibility with existing databases
        await sql`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS session_id VARCHAR(255);`;
        await sql`ALTER TABLE rooms ADD COLUMN IF NOT EXISTS name VARCHAR(255);`;

        console.log("Database schema initialized successfully.");
    } catch (err) {
        console.error("Error initializing schema:", err);
        throw err;
    }
}

module.exports = {
    sql,
    initializeSchema
};
