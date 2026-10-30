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
            photo_url TEXT,
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

        // GitHub integration: one encrypted OAuth token per user, and project <-> repo links.
        await sql`
        CREATE TABLE IF NOT EXISTS github_connections (
            user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
            gh_login VARCHAR(100) NOT NULL,
            token_encrypted TEXT NOT NULL,
            scopes VARCHAR(255) DEFAULT '',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        `;
        // A project synced with a repo: the folder `path` on `branch` maps to the project root,
        // `base_sha` is the commit both sides last agreed on, and `skipped` lists repo files the
        // project can't hold (binary, over 1 MB), so their absence is not read as a deletion.
        await sql`
        CREATE TABLE IF NOT EXISTS github_links (
            project_id INTEGER PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
            owner VARCHAR(100) NOT NULL,
            repo VARCHAR(100) NOT NULL,
            branch VARCHAR(255) NOT NULL,
            path VARCHAR(500) DEFAULT '',
            base_sha VARCHAR(40) NOT NULL,
            skipped JSONB DEFAULT '[]'::jsonb,
            linked_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        `;

        // Ensure missing columns exist for backward compatibility with existing databases
        await sql`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS session_id VARCHAR(255);`;
        // Device list: a custom name per device, and soft revocation so a removed device
        // signs itself out the next time it checks in.
        await sql`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;`;
        await sql`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS last_active TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;`;
        await sql`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS name VARCHAR(80);`;
        await sql`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMP WITH TIME ZONE;`;
        await sql`ALTER TABLE rooms ADD COLUMN IF NOT EXISTS name VARCHAR(255);`;
        // Scheduled calls/meetings in a room.
        await sql`
        CREATE TABLE IF NOT EXISTS meetings (
            id VARCHAR(32) PRIMARY KEY,
            room_id VARCHAR(255) NOT NULL,
            title VARCHAR(200) NOT NULL,
            description TEXT DEFAULT '',
            starts_at TIMESTAMP WITH TIME ZONE NOT NULL,
            duration_min INTEGER NOT NULL DEFAULT 30,
            time_zone VARCHAR(64) DEFAULT 'UTC',
            host_uid VARCHAR(128) NOT NULL,
            host_name VARCHAR(120),
            host_email VARCHAR(200),
            invitees JSONB DEFAULT '[]'::jsonb,
            access VARCHAR(16) DEFAULT 'public',
            reminded_at TIMESTAMP WITH TIME ZONE,
            cancelled_at TIMESTAMP WITH TIME ZONE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        `;
        await sql`CREATE INDEX IF NOT EXISTS meetings_starts_at ON meetings (starts_at);`;
        // Room access: who owns a room, who may join it (public link, invite-only, private).
        await sql`ALTER TABLE rooms ADD COLUMN IF NOT EXISTS owner_uid VARCHAR(128);`;
        await sql`ALTER TABLE rooms ADD COLUMN IF NOT EXISTS visibility VARCHAR(16) DEFAULT 'public';`;
        await sql`ALTER TABLE rooms ADD COLUMN IF NOT EXISTS allowed_emails JSONB DEFAULT '[]'::jsonb;`;
        // Older databases created organizations with "created_by" instead of "owner_id".
        await sql`ALTER TABLE organizations ADD COLUMN IF NOT EXISTS owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL;`;
        await sql`
            DO $$ BEGIN
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'created_by') THEN
                    UPDATE organizations SET owner_id = created_by WHERE owner_id IS NULL;
                END IF;
            END $$;
        `;
        // Older databases named the notification flag "is_read"; the code uses "read".
        await sql`ALTER TABLE notifications ADD COLUMN IF NOT EXISTS read BOOLEAN DEFAULT FALSE;`;
        await sql`
            DO $$ BEGIN
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'is_read') THEN
                    UPDATE notifications SET read = COALESCE(is_read, FALSE) WHERE read IS DISTINCT FROM COALESCE(is_read, FALSE) AND read = FALSE;
                END IF;
            END $$;
        `;
        // Project chat lives with the project (rooms rows are cleaned up after idle hours).
        await sql`ALTER TABLE projects ADD COLUMN IF NOT EXISTS chat_history JSONB DEFAULT '[]'::jsonb;`;
        // When each person last opened a room ("last active" on their dashboard).
        // Added empty (a default here would stamp every existing row "now"), then defaulted.
        await sql`ALTER TABLE user_rooms ADD COLUMN IF NOT EXISTS last_opened_at TIMESTAMP WITH TIME ZONE;`;
        await sql`ALTER TABLE user_rooms ALTER COLUMN last_opened_at SET DEFAULT CURRENT_TIMESTAMP;`;
        // users created before these columns existed (CREATE TABLE IF NOT EXISTS never adds columns)
        await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT DEFAULT '';`;
        await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS social_links JSONB DEFAULT '{}'::jsonb;`;
        await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_room_id VARCHAR(255);`;
        await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_unsubscribed BOOLEAN DEFAULT FALSE;`;
        await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS photo_url TEXT;`;
        await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS pairing_seconds INTEGER DEFAULT 0;`;
        // Billing: plan state is written only by the Stripe webhook.
        await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS plan VARCHAR(20) DEFAULT 'free';`;
        await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS plan_status VARCHAR(30);`;
        await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS plan_interval VARCHAR(10);`;
        await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS plan_renews_at TIMESTAMP WITH TIME ZONE;`;
        await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS plan_cancel_at_period_end BOOLEAN DEFAULT FALSE;`;
        await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMP WITH TIME ZONE;`;
        await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(80);`;
        await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_subscription_id VARCHAR(80);`;

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
