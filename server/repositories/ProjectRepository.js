const { sql } = require('./DatabaseClient');

/**
 * Create a new multi-file project with starter templates
 */
async function createProject(userId, name, description = "", type = "web") {
    const user = await sql`SELECT id FROM users WHERE auth_provider_id = ${userId}`;
    if (!user.length) throw new Error("User not found");

    const project = await sql`
        INSERT INTO projects (user_id, name, description, type)
        VALUES (${user[0].id}, ${name}, ${description}, ${type})
        RETURNING *
    `;

    const projectId = project[0].id;

    if (type === "web") {
        await sql`
            INSERT INTO project_files (project_id, name, path, content)
            VALUES 
                (${projectId}, 'index.html', 'index.html', '<!DOCTYPE html>\n<html>\n<head>\n  <title>New Project</title>\n</head>\n<body>\n  <h1>Hello World</h1>\n</body>\n</html>'),
                (${projectId}, 'style.css', 'style.css', 'body {\n  background-color: #f0f0f0;\n  font-family: sans-serif;\n}'),
                (${projectId}, 'script.js', 'script.js', 'console.log("Hello from script.js");')
        `;
    } else if (type === "cpp") {
        await sql`
            INSERT INTO project_files (project_id, name, path, content)
            VALUES 
                (${projectId}, 'main.cpp', 'main.cpp', '#include <iostream>\n\nint main() {\n    std::cout << "Hello Utkristi Colabs!" << std::endl;\n    return 0;\n}'),
                (${projectId}, 'utils.h', 'utils.h', '// Utility functions\n#ifndef UTILS_H\n#define UTILS_H\n\nvoid greet();\n\n#endif')
        `;
    } else if (type === "python") {
        await sql`
            INSERT INTO project_files (project_id, name, path, content)
            VALUES (${projectId}, 'main.py', 'main.py', 'def main():\n    print("Hello from Utkristi Colabs!")\n\nif __name__ == "__main__":\n    main()')
        `;
    } else if (type === "java") {
        await sql`
            INSERT INTO project_files (project_id, name, path, content)
            VALUES (${projectId}, 'Main.java', 'Main.java', 'public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello from Java!");\n    }\n}')
        `;
    } else {
        await sql`
            INSERT INTO project_files (project_id, name, path, content)
            VALUES (${projectId}, 'index.html', 'index.html', '<h1>Hello World</h1>')
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

module.exports = {
    createProject,
    getProjects,
    getProject,
    getProjectFiles,
    upsertProjectFile,
    deleteProjectFile,
    deleteProject
};
