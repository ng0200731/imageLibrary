console.log('Starting server...');
const express = require('express');
const Database = require('better-sqlite3');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { sendProjectEmail } = require('./email_service');
console.log('All modules loaded successfully');

const app = express();
const port = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

// Serve static files
app.use(express.static('../'));

// Route for login page
app.get('/login.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../login.html'));
});

// Route for admin page
app.get('/admin.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../admin.html'));
});

// Route for main app
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../index.html'));
});

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

// 3. Get All Tags (for autocomplete)
app.get('/tags', (req, res) => {
    try {
        const query = req.query.q ? req.query.q.toLowerCase() : '';
        let tags;

        if (query) {
            // Search for tags that contain the query string
            tags = db.prepare(`
                SELECT name, COUNT(it.image_id) as usage_count
                FROM tags t
                LEFT JOIN image_tags it ON t.id = it.tag_id
                WHERE LOWER(t.name) LIKE ?
                GROUP BY t.id, t.name
                ORDER BY usage_count DESC, t.name ASC
            `).all(`%${query}%`);
        } else {
            // Get all tags with usage count
            tags = db.prepare(`
                SELECT name, COUNT(it.image_id) as usage_count
                FROM tags t
                LEFT JOIN image_tags it ON t.id = it.tag_id
                GROUP BY t.id, t.name
                ORDER BY usage_count DESC, t.name ASC
            `).all();
        }

        res.json(tags);
    } catch (err) {
        console.error('Error fetching tags:', err.message);
        res.status(500).send('Error fetching tags');
    }
});

// 4. Update Image Tags
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

// --- Authentication Endpoints ---

// Send verification code
app.post('/auth/send-code', async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ error: 'Email is required' });
    }

    try {
        // Check if user exists
        let user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
        let userStatus = 'existing';

        if (!user) {
            // Create new user with pending status
            const stmt = db.prepare('INSERT INTO users (email, status, role) VALUES (?, ?, ?)');
            const result = stmt.run(email, 'pending', 'user');
            user = { id: result.lastInsertRowid, email, status: 'pending', role: 'user' };
            userStatus = 'new';
        } else if (user.status === 'pending') {
            userStatus = 'pending';
        }

        // Generate verification code
        const code = generateVerificationCode();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        // Store verification code
        db.prepare('INSERT INTO verification_codes (email, code, expires_at) VALUES (?, ?, ?)').run(
            email, code, expiresAt.toISOString()
        );

        // Send email based on user status
        console.log(`Attempting to send verification email to ${email} with status ${userStatus}`);
        try {
            await sendVerificationEmail(email, code, userStatus);
            console.log(`Verification email sent successfully to ${email}`);
        } catch (emailError) {
            console.error('Email sending failed:', emailError);
            return res.status(500).json({ error: 'Failed to send verification email. Please try again.' });
        }

        let message;
        if (userStatus === 'new') {
            message = 'Verification code sent. Your application is under review.';
        } else if (userStatus === 'pending') {
            message = 'Verification code sent. Your application is still under review.';
        } else if (user.status === 'approved') {
            message = 'Verification code sent to your email.';
        } else {
            message = 'Your account is not approved for access.';
        }

        res.json({ message, userStatus: user.status });

    } catch (error) {
        console.error('Error in send-code endpoint:', error);
        res.status(500).json({ error: 'Failed to send verification code' });
    }
});

// Verify code and login
app.post('/auth/verify-code', async (req, res) => {
    const { email, code } = req.body;

    if (!email || !code) {
        return res.status(400).json({ error: 'Email and code are required' });
    }

    try {
        // Check verification code
        const verificationRecord = db.prepare(`
            SELECT * FROM verification_codes
            WHERE email = ? AND code = ? AND used = FALSE AND expires_at > datetime('now')
            ORDER BY created_at DESC LIMIT 1
        `).get(email, code);

        if (!verificationRecord) {
            return res.status(400).json({ error: 'Invalid or expired verification code' });
        }

        // Check user status
        const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

        if (!user) {
            return res.status(400).json({ error: 'User not found' });
        }

        if (user.status !== 'approved') {
            return res.status(403).json({ error: 'Account not approved for access' });
        }

        // Mark code as used
        db.prepare('UPDATE verification_codes SET used = TRUE WHERE id = ?').run(verificationRecord.id);

        // Update last login
        db.prepare('UPDATE users SET last_login = datetime(\'now\') WHERE id = ?').run(user.id);

        // Generate session token
        const sessionToken = generateSessionToken();
        const sessionExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

        // Store session
        db.prepare('INSERT INTO login_sessions (user_id, session_token, expires_at) VALUES (?, ?, ?)').run(
            user.id, sessionToken, sessionExpiresAt.toISOString()
        );

        res.json({
            message: 'Login successful',
            sessionToken,
            user: {
                id: user.id,
                email: user.email,
                role: user.role
            }
        });

    } catch (error) {
        console.error('Error verifying code:', error);
        res.status(500).json({ error: 'Failed to verify code' });
    }
});

// Verify session
app.get('/auth/verify-session', async (req, res) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No valid session token' });
    }

    const sessionToken = authHeader.substring(7);

    try {
        const session = db.prepare(`
            SELECT s.*, u.email, u.role, u.status
            FROM login_sessions s
            JOIN users u ON s.user_id = u.id
            WHERE s.session_token = ? AND s.expires_at > datetime('now')
        `).get(sessionToken);

        if (!session) {
            return res.status(401).json({ error: 'Invalid or expired session' });
        }

        res.json({
            user: {
                id: session.user_id,
                email: session.email,
                role: session.role,
                status: session.status
            }
        });

    } catch (error) {
        console.error('Error verifying session:', error);
        res.status(500).json({ error: 'Failed to verify session' });
    }
});

// Logout endpoint
app.post('/auth/logout', async (req, res) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.json({ message: 'Logged out successfully' });
    }

    const sessionToken = authHeader.substring(7);

    try {
        // Delete the session from database
        db.prepare('DELETE FROM login_sessions WHERE session_token = ?').run(sessionToken);

        res.json({ message: 'Logged out successfully' });

    } catch (error) {
        console.error('Error during logout:', error);
        res.json({ message: 'Logged out successfully' }); // Always return success for logout
    }
});

// Admin: Get all users (requires admin role)
app.get('/admin/users', async (req, res) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No valid session token' });
    }

    const sessionToken = authHeader.substring(7);

    try {
        // Verify admin session
        const session = db.prepare(`
            SELECT s.*, u.email, u.role
            FROM login_sessions s
            JOIN users u ON s.user_id = u.id
            WHERE s.session_token = ? AND s.expires_at > datetime('now') AND u.role = 'admin'
        `).get(sessionToken);

        if (!session) {
            return res.status(403).json({ error: 'Admin access required' });
        }

        // Get all users
        const users = db.prepare(`
            SELECT id, email, status, role, created_at, approved_at, last_login
            FROM users
            ORDER BY created_at DESC
        `).all();

        res.json(users);

    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

// Admin: Approve user
app.post('/admin/users/:id/approve', async (req, res) => {
    const authHeader = req.headers.authorization;
    const userId = parseInt(req.params.id);

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No valid session token' });
    }

    const sessionToken = authHeader.substring(7);

    try {
        // Verify admin session
        const session = db.prepare(`
            SELECT s.*, u.email, u.role
            FROM login_sessions s
            JOIN users u ON s.user_id = u.id
            WHERE s.session_token = ? AND s.expires_at > datetime('now') AND u.role = 'admin'
        `).get(sessionToken);

        if (!session) {
            return res.status(403).json({ error: 'Admin access required' });
        }

        // Get user to approve
        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Update user status
        db.prepare('UPDATE users SET status = ?, approved_at = datetime(\'now\') WHERE id = ?').run('approved', userId);

        // Send approval email
        await sendApprovalEmail(user.email);

        res.json({ message: 'User approved successfully' });

    } catch (error) {
        console.error('Error approving user:', error);
        res.status(500).json({ error: 'Failed to approve user' });
    }
});

// Generate random 6-digit code
function generateVerificationCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// Generate session token
function generateSessionToken() {
    return crypto.randomBytes(32).toString('hex');
}

// Send verification code email
async function sendVerificationEmail(email, code, userStatus) {
    // Use the same email configuration as the existing email service
    const GMAIL_CONFIG = {
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        auth: {
            user: 'eric.brilliant@gmail.com',
            pass: 'opqx pfna kagb bznr'
        }
    };

    const transporter = nodemailer.createTransport(GMAIL_CONFIG);

    let subject, content;

    if (userStatus === 'new') {
        subject = 'Registration of Image Library';
        content = `
            <h2>Welcome to Image Library</h2>
            <p>Your verification code is: <strong>${code}</strong></p>
            <p>We are reviewing your application, and once it is approved, we will send email to update.</p>
            <p>This code expires in 10 minutes.</p>
        `;
    } else if (userStatus === 'pending') {
        subject = 'Your application of the image library is still under reviewing';
        content = `
            <h2>Application Under Review</h2>
            <p>Your verification code is: <strong>${code}</strong></p>
            <p>We are reviewing your application, and once it is approved, we will send email to update.</p>
            <p>This code expires in 10 minutes.</p>
        `;
    } else {
        subject = 'Image Library - Verification Code';
        content = `
            <h2>Login Verification</h2>
            <p>Your verification code is: <strong>${code}</strong></p>
            <p>This code expires in 10 minutes.</p>
        `;
    }

    const mailOptions = {
        from: 'eric.brilliant@gmail.com',
        to: email,
        subject: subject,
        html: content
    };

    await transporter.sendMail(mailOptions);
}

// Send approval email
async function sendApprovalEmail(email) {
    // Use the same email configuration as the existing email service
    const GMAIL_CONFIG = {
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        auth: {
            user: 'eric.brilliant@gmail.com',
            pass: 'opqx pfna kagb bznr'
        }
    };

    const transporter = nodemailer.createTransport(GMAIL_CONFIG);

    const mailOptions = {
        from: 'eric.brilliant@gmail.com',
        to: email,
        subject: 'Approval access of image library',
        html: `
            <h2>Application Approved!</h2>
            <p>We have approved your application.</p>
            <p>You can now access the Image Library system.</p>
        `
    };

    await transporter.sendMail(mailOptions);
}

app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
});