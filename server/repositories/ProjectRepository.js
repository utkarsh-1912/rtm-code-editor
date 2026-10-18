const { sql } = require('./DatabaseClient');
const { languages: LANGUAGES } = require('../../src/shared/languages.json');

/**
 * Create a new multi-file project with starter templates
 */
async function createProject(userId, name, description = "", type = "web", { empty = false } = {}) {
    const user = await sql`SELECT id FROM users WHERE auth_provider_id = ${userId}`;
    if (!user.length) throw new Error("User not found");

    const project = await sql`
        INSERT INTO projects (user_id, name, description, type)
        VALUES (${user[0].id}, ${name}, ${description}, ${type})
        RETURNING *
    `;

    const projectId = project[0].id;

    // Imported projects bring their own files.
    if (empty) return project[0];

    if (type === "web") {
        await sql`
            INSERT INTO project_files (project_id, name, path, content)
            VALUES 
                (${projectId}, 'index.html', 'index.html', '<!DOCTYPE html>\n<html>\n<head>\n  <title>New Project</title>\n</head>\n<body>\n  <h1>Hello World</h1>\n</body>\n</html>'),
                (${projectId}, 'style.css', 'style.css', 'body {\n  background-color: #f0f0f0;\n  font-family: sans-serif;\n}'),
                (${projectId}, 'script.js', 'script.js', 'console.log("Hello from script.js");')
        `;
    } else {
        // Any runnable language: its starter file from the shared catalogue, plus a short README.
        const lang = LANGUAGES.find((l) => l.id === type) || LANGUAGES.find((l) => l.id === 'javascript');
        const readme = `# ${name}

${lang.label} project. Open ${lang.file} and press Run.
Input for the program goes in the Input panel.
`;
        await sql`
            INSERT INTO project_files (project_id, name, path, content)
            VALUES
                (${projectId}, ${lang.file}, ${lang.file}, ${lang.template}),
                (${projectId}, 'README.md', 'README.md', ${readme})
        `;
    }

    return project[0];
}

async function getProjects(userId) {
    const user = await sql`SELECT id FROM users WHERE auth_provider_id = ${userId}`;
    if (!user.length) return [];

    return await sql`
        SELECT * FROM projects 
        WHERE user_id = ${user[0].id} 
        ORDER BY updated_at DESC
    `;
}

async function getProject(projectId) {
    const res = await sql`SELECT * FROM projects WHERE id = ${projectId}`;
    return res[0] || null;
}

async function getProjectFiles(projectId) {
    return await sql`
        SELECT * FROM project_files 
        WHERE project_id = ${projectId} 
        ORDER BY is_directory DESC, name ASC
    `;
}

async function upsertProjectFile(projectId, name, path, content, isDirectory = false) {
    return await sql`
        INSERT INTO project_files (project_id, name, path, content, is_directory, updated_at)
        VALUES (${projectId}, ${name}, ${path}, ${content}, ${isDirectory}, CURRENT_TIMESTAMP)
        ON CONFLICT (project_id, path)
        DO UPDATE SET 
            content = EXCLUDED.content,
            name = EXCLUDED.name,
            updated_at = CURRENT_TIMESTAMP
        RETURNING *;
    `;
}

async function deleteProjectFile(projectId, path) {
    return await sql`DELETE FROM project_files WHERE project_id = ${projectId} AND path = ${path}`;
}

async function deleteProject(projectId) {
    return await sql`DELETE FROM projects WHERE id = ${projectId}`;
}

// Insert or update many files in one statement (folder import). Files are matched to
// existing rows with or without a leading "/" (starter files are stored without one), so
// re-importing a file updates it instead of adding a duplicate. Returns the stored rows.
async function upsertProjectFiles(projectId, files) {
    const existing = await sql`SELECT path FROM project_files WHERE project_id = ${projectId}`;
    const actual = new Map(existing.map((r) => [r.path.replace(/^[/]+/, ''), r.path]));
    const byPath = new Map();
    for (const f of files) {
        const path = actual.get(f.path.replace(/^[/]+/, '')) || f.path;
        byPath.set(path, { ...f, path }); // last one wins within a batch
    }
    const rows = [...byPath.values()];
    if (!rows.length) return [];
    return await sql`
        INSERT INTO project_files (project_id, name, path, content, is_directory, updated_at)
        SELECT ${projectId}, n, p, c, false, CURRENT_TIMESTAMP
        FROM unnest(${rows.map((r) => r.name)}::text[], ${rows.map((r) => r.path)}::text[], ${rows.map((r) => r.content)}::text[]) AS t(n, p, c)
        ON CONFLICT (project_id, path)
        DO UPDATE SET content = EXCLUDED.content, name = EXCLUDED.name, updated_at = CURRENT_TIMESTAMP
        RETURNING *;
    `;
}

module.exports = {
    createProject,
    upsertProjectFiles,
    getProjects,
    getProject,
    getProjectFiles,
    upsertProjectFile,
    deleteProjectFile,
    deleteProject
};
