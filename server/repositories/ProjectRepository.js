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

// Insert or update many files at once (folder import). Returns the stored rows.
async function upsertProjectFiles(projectId, files) {
    const out = [];
    for (const f of files) {
        const rows = await upsertProjectFile(projectId, f.name, f.path, f.content, false);
        out.push(rows[0] || rows);
    }
    return out;
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
