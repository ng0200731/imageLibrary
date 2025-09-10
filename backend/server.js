console.log('Starting server...');
const express = require('express');
const Database = require('better-sqlite3');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { sendProjectEmail } = require('./email_service');
console.log('All modules loaded successfully');

const app = express();
const port = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

// --- Database Connection ---
const db = new Database('database.sqlite');
console.log('Connected to the better-sqlite3 database.');

// --- File Upload Setup ---
const uploadDir = './uploads';
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage: storage });

// --- API Endpoints ---

// 1. Upload Images
app.post('/upload', upload.array('images'), (req, res) => {
    const tags = req.body.tags ? JSON.parse(req.body.tags) : [];
    const files = req.files;

    if (!files || files.length === 0) {
        return res.status(400).send('No files uploaded.');
    }

    // Extract objective metadata from tags
    function extractMetadata(tags) {
        const metadata = {
            book: null,
            page: null,
            row: null,
            column: null,
            type: null,
            material: null,
            dimension: null,
            remark: null,
            brand: null,
            color: null
        };

        const regularTags = [];

        tags.forEach(tag => {
            const colonIndex = tag.indexOf(':');
            if (colonIndex > 0) {
                const key = tag.substring(0, colonIndex).toLowerCase();
                const value = tag.substring(colonIndex + 1);

                if (metadata.hasOwnProperty(key)) {
                    metadata[key] = value;
                } else {
                    regularTags.push(tag);
                }
            } else {
                regularTags.push(tag);
            }
        });

        return { metadata, regularTags };
    }

    const { metadata, regularTags } = extractMetadata(tags);

    // Prepare all statements once, outside the transaction
    const insertImage = db.prepare(`
        INSERT INTO images (filepath, book, page, row, column, type, material, dimension, remark, brand, color, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `);
    const insertTag = db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)');
    const getTagId = db.prepare('SELECT id FROM tags WHERE name = ?');
    const linkImageToTag = db.prepare('INSERT INTO image_tags (image_id, tag_id) VALUES (?, ?)');

    // Create a single, reusable transaction function
    const uploadTransaction = db.transaction((files, metadata, regularTags) => {
        for (const file of files) {
            let imageResult;
            let filePath = file.path;
            let attempts = 0;
            const maxAttempts = 10;

            // Handle UNIQUE constraint on filepath by generating new filename if needed
            console.log(`Processing file: ${file.originalname}, path: ${filePath}`);
            while (attempts < maxAttempts) {
                try {
                    console.log(`Attempt ${attempts + 1}: Inserting ${filePath} into database`);
                    imageResult = insertImage.run(
                        filePath,
                        metadata.book,
                        metadata.page,
                        metadata.row,
                        metadata.column,
                        metadata.type,
                        metadata.material,
                        metadata.dimension,
                        metadata.remark,
                        metadata.brand,
                        metadata.color
                    );
                    break; // Success, exit the retry loop
                } catch (err) {
                    console.log('Database insert error:', err.code, err.message);
                    if ((err.code === 'SQLITE_CONSTRAINT_UNIQUE' || err.message.includes('UNIQUE constraint failed')) && attempts < maxAttempts - 1) {
                        // Generate a new unique filename
                        attempts++;
                        const timestamp = Date.now() + attempts;
                        const ext = path.extname(file.originalname);
                        const newFilename = timestamp + ext;
                        const newFilePath = path.join(uploadDir, newFilename);

                        // Rename the physical file
                        fs.renameSync(file.path, newFilePath);
                        filePath = newFilePath;

                        console.log(`Filepath conflict resolved. Renamed to: ${newFilePath}`);
                    } else {
                        throw err; // Re-throw if not a UNIQUE constraint error or max attempts reached
                    }
                }
            }
            const imageId = imageResult.lastInsertRowid;

            // Link all original tags (includes both metadata and regular tags)
            if (tags && tags.length > 0) {
                for (const tag of tags) {
                    insertTag.run(tag);
                    const tagRow = getTagId.get(tag);
                    if (tagRow) {
                        linkImageToTag.run(imageId, tagRow.id);
                    }
                }
            }
        }
    });

    try {
        console.log('=== Upload Debug Info ===');
        console.log('Files:', files.length);
        console.log('Metadata:', metadata);
        console.log('Regular tags:', regularTags);

        // Execute the transaction with the data
        uploadTransaction(files, metadata, regularTags);

        console.log('Upload successful:', {
            files: files.length,
            metadata: metadata,
            regularTags: regularTags.length
        });

        res.status(200).send({
            message: 'Files uploaded successfully',
            count: files.length,
            metadata: metadata,
            tags: regularTags.length
        });
    } catch (err) {
        console.error('=== Upload Error ===');
        console.error('Error details:', err);
        console.error('Stack trace:', err.stack);
        res.status(500).send(`An error occurred during upload: ${err.message}`);
    }
});

// 2. Search Images
app.get('/images', (req, res) => {
    const tags = req.query.tags ? req.query.tags.split(',').filter(t => t) : [];
    const mode = req.query.mode || 'OR';

    try {
        let images;

        if (tags.length === 0) {
            images = db.prepare('SELECT * FROM images').all();
        } else {
            const placeholders = tags.map(() => '?').join(',');
            let query;
            let params;

            if (mode.toUpperCase() === 'AND') {
                query = `
                    SELECT i.* FROM images i
                    JOIN image_tags it ON i.id = it.image_id
                    JOIN tags t ON it.tag_id = t.id
                    WHERE t.name IN (${placeholders})
                    GROUP BY i.id
                    HAVING COUNT(DISTINCT t.name) = ?
                `;
                params = [...tags, tags.length];
            } else { // OR
                query = `
                    SELECT DISTINCT i.* FROM images i
                    JOIN image_tags it ON i.id = it.image_id
                    JOIN tags t ON it.tag_id = t.id
                    WHERE t.name IN (${placeholders})
                `;
                params = tags;
            }
            images = db.prepare(query).all(params);
        }

        // Get tags for each image
        const getImageTags = db.prepare(`
            SELECT t.name FROM tags t
            JOIN image_tags it ON t.id = it.tag_id
            WHERE it.image_id = ?
        `);

        const imagesWithTags = images.map(image => {
            const imageTags = getImageTags.all(image.id);
            return {
                ...image,
                tags: imageTags.map(tag => tag.name)
            };
        });

        res.json(imagesWithTags);
    } catch (err) {
        console.error('Error searching images:', err.message);
        res.status(500).send('Error searching images');
    }
});

// 3. Update Image Tags
app.put('/images/:id/tags', (req, res) => {
    const imageId = parseInt(req.params.id);
    const { tags } = req.body;

    if (!Array.isArray(tags)) {
        return res.status(400).send('Tags must be an array');
    }

    try {
        // Start transaction
        const transaction = db.transaction(() => {
            // Remove all existing tags for this image
            db.prepare('DELETE FROM image_tags WHERE image_id = ?').run(imageId);

            // Add new tags
            for (const tagName of tags) {
                if (!tagName.trim()) continue;

                // Get or create tag
                let tag = db.prepare('SELECT id FROM tags WHERE name = ?').get(tagName.trim());
                if (!tag) {
                    const insertTag = db.prepare('INSERT INTO tags (name) VALUES (?)');
                    const result = insertTag.run(tagName.trim());
                    tag = { id: result.lastInsertRowid };
                }

                // Link tag to image
                db.prepare('INSERT INTO image_tags (image_id, tag_id) VALUES (?, ?)').run(imageId, tag.id);
            }
        });

        transaction();

        // Return updated image with tags
        const getImageTags = db.prepare(`
            SELECT t.name FROM tags t
            JOIN image_tags it ON t.id = it.tag_id
            WHERE it.image_id = ?
        `);

        const imageTags = getImageTags.all(imageId);
        const updatedImage = {
            id: imageId,
            tags: imageTags.map(tag => tag.name)
        };

        res.json(updatedImage);
    } catch (err) {
        console.error('Error updating image tags:', err.message);
        res.status(500).send('Error updating image tags');
    }
});

// --- Projects API Endpoints ---

// Get all projects
app.get('/projects', (req, res) => {
    try {
        const projects = db.prepare('SELECT * FROM projects ORDER BY created_at DESC').all();

        // Parse image_ids for each project (handle different formats)
        const projectsWithParsedIds = projects.map(project => {
            let imageIds = [];

            try {
                // Try JSON parse first (for format like [1,2,3])
                if (project.image_ids.startsWith('[') && project.image_ids.endsWith(']')) {
                    imageIds = JSON.parse(project.image_ids);
                } else {
                    // Handle comma-separated format (like "1,2,3" or "NaN,1,2,3")
                    imageIds = project.image_ids
                        .split(',')
                        .map(id => parseInt(id.trim()))
                        .filter(id => !isNaN(id)); // Remove NaN values
                }
            } catch (err) {
                console.warn(`Failed to parse image_ids for project ${project.id}: ${project.image_ids}`);
                imageIds = [];
            }

            return {
                ...project,
                image_ids: imageIds
            };
        });

        res.json(projectsWithParsedIds);
    } catch (err) {
        console.error('Error fetching projects:', err.message);
        res.status(500).send('Error fetching projects');
    }
});

// Create a new project
app.post('/projects', (req, res) => {
    try {
        const { name, image_ids } = req.body;

        if (!name || !image_ids || !Array.isArray(image_ids)) {
            return res.status(400).send('Project name and image_ids array are required');
        }

        const stmt = db.prepare('INSERT INTO projects (name, image_ids) VALUES (?, ?)');
        const result = stmt.run(name, JSON.stringify(image_ids));

        const newProject = {
            id: result.lastInsertRowid,
            name: name,
            image_ids: image_ids,
            created_at: new Date().toISOString()
        };

        res.status(201).json(newProject);
    } catch (err) {
        console.error('Error creating project:', err.message);
        res.status(500).send('Error creating project');
    }
});

// Delete a project
app.delete('/projects/:id', (req, res) => {
    try {
        const projectId = parseInt(req.params.id);

        if (isNaN(projectId)) {
            return res.status(400).send('Invalid project ID');
        }

        const stmt = db.prepare('DELETE FROM projects WHERE id = ?');
        const result = stmt.run(projectId);

        if (result.changes === 0) {
            return res.status(404).send('Project not found');
        }

        res.status(200).send('Project deleted successfully');
    } catch (err) {
        console.error('Error deleting project:', err.message);
        res.status(500).send('Error deleting project');
    }
});

// Delete an image
app.delete('/images/:id', (req, res) => {
    try {
        const imageId = parseInt(req.params.id);

        if (isNaN(imageId)) {
            return res.status(400).send('Invalid image ID');
        }

        // Get image filepath before deletion for file cleanup
        const imageStmt = db.prepare('SELECT filepath FROM images WHERE id = ?');
        const image = imageStmt.get(imageId);

        if (!image) {
            return res.status(404).send('Image not found');
        }

        // Start transaction to delete image and related data
        const transaction = db.transaction(() => {
            // Delete from image_tags table (foreign key constraint)
            db.prepare('DELETE FROM image_tags WHERE image_id = ?').run(imageId);

            // Remove image from projects (update image_ids field)
            const projects = db.prepare('SELECT id, image_ids FROM projects').all();
            projects.forEach(project => {
                const imageIds = project.image_ids.split(',').map(id => parseInt(id.trim()));
                if (imageIds.includes(imageId)) {
                    const updatedImageIds = imageIds.filter(id => id !== imageId);
                    const updatedImageIdsStr = updatedImageIds.join(',');
                    db.prepare('UPDATE projects SET image_ids = ? WHERE id = ?').run(updatedImageIdsStr, project.id);
                    console.log(`Removed image ${imageId} from project ${project.id}`);
                }
            });

            // Delete from images table
            const result = db.prepare('DELETE FROM images WHERE id = ?').run(imageId);

            if (result.changes === 0) {
                throw new Error('Image not found');
            }
        });

        transaction();

        // Delete the physical file
        const fs = require('fs');
        const path = require('path');

        try {
            const fullPath = path.resolve(image.filepath);
            if (fs.existsSync(fullPath)) {
                fs.unlinkSync(fullPath);
                console.log(`Deleted file: ${fullPath}`);
            } else {
                console.warn(`File not found for deletion: ${fullPath}`);
            }
        } catch (fileErr) {
            console.error(`Error deleting file ${image.filepath}:`, fileErr.message);
            // Don't fail the request if file deletion fails
        }

        console.log(`Successfully deleted image ${imageId} and file ${image.filepath}`);
        res.status(200).json({ message: 'Image deleted successfully', imageId: imageId });

    } catch (err) {
        console.error('Error deleting image:', err.message);
        res.status(500).send('Error deleting image: ' + err.message);
    }
});

// 7. Share Project via Email
app.post('/projects/:id/share', async (req, res) => {
    const projectId = req.params.id;
    const { recipient_email, message, breakdown_text } = req.body;

    if (!recipient_email) {
        return res.status(400).send('Recipient email is required');
    }

    try {
        // Get project details
        const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
        if (!project) {
            return res.status(404).send('Project not found');
        }

        // Get project images with tags - clean the image_ids string first
        const cleanImageIds = project.image_ids.replace(/[\[\]]/g, ''); // Remove square brackets
        const imageIds = cleanImageIds.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));

        const placeholders = imageIds.map(() => '?').join(',');
        const query = `
            SELECT i.*, GROUP_CONCAT(t.name) as tags
            FROM images i
            LEFT JOIN image_tags it ON i.id = it.image_id
            LEFT JOIN tags t ON it.tag_id = t.id
            WHERE i.id IN (${placeholders})
            GROUP BY i.id
        `;

        const projectImages = db.prepare(query).all(...imageIds);

        // Format images data for email
        const imagesWithTags = projectImages.map(img => ({
            ...img,
            tags: img.tags ? img.tags.split(',') : []
        }));

        const projectData = {
            name: project.name,
            created_at: project.created_at,
            images: imagesWithTags,
            breakdown_text: breakdown_text  // Pass the breakdown text from frontend
        };

        // Send email
        const emailSent = await sendProjectEmail(projectData, recipient_email, message);

        // Log email sending attempt to database
        try {
            const logEmailStmt = db.prepare(`
                INSERT INTO email_history (project_id, recipient_email, sender_message, success)
                VALUES (?, ?, ?, ?)
            `);
            logEmailStmt.run(projectId, recipient_email, message || '', emailSent ? 1 : 0);
            console.log(`Email history logged: Project ${projectId} to ${recipient_email}, success: ${emailSent}`);
        } catch (logError) {
            console.error('Failed to log email history:', logError);
            // Don't fail the request if logging fails
        }

        if (emailSent) {
            res.status(200).json({
                success: true,
                message: `Project "${project.name}" shared successfully with ${recipient_email}`
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'Failed to send email. Please try again.'
            });
        }
    } catch (err) {
        console.error('Error sharing project:', err.message);
        res.status(500).json({
            success: false,
            message: 'Error sharing project: ' + err.message
        });
    }
});

// 8. Get Email History for a Project
app.get('/projects/:id/email-history', (req, res) => {
    const projectId = req.params.id;

    try {
        const emailHistory = db.prepare(`
            SELECT recipient_email, sender_message, sent_at, success
            FROM email_history
            WHERE project_id = ?
            ORDER BY sent_at DESC
        `).all(projectId);

        res.json(emailHistory);
    } catch (err) {
        console.error('Error fetching email history:', err.message);
        res.status(500).send('Error fetching email history');
    }
});

app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
});