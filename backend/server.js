const express = require('express');
const Database = require('better-sqlite3');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

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

    // Prepare all statements once, outside the transaction. This is more efficient.
    const insertImage = db.prepare('INSERT INTO images (filepath) VALUES (?)');
    const insertTag = db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)');
    const getTagId = db.prepare('SELECT id FROM tags WHERE name = ?');
    const linkImageToTag = db.prepare('INSERT INTO image_tags (image_id, tag_id) VALUES (?, ?)');

    // Create a single, reusable transaction function.
    const uploadTransaction = db.transaction((files, tags) => {
        for (const file of files) {
            const imageResult = insertImage.run(file.path);
            const imageId = imageResult.lastInsertRowid;

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
        // Execute the transaction with the data.
        uploadTransaction(files, tags);
        res.status(200).send({ message: 'Files uploaded successfully', count: files.length });
    } catch (err) {
        console.error('Transaction failed:', err);
        res.status(500).send('An error occurred during upload.');
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

app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
});