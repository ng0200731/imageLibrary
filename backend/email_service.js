const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// Email Configuration
const GMAIL_CONFIG = {
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
        user: 'eric.brilliant@gmail.com',
        pass: 'opqx pfna kagb bznr'
    }
};

const BACKUP_CONFIG = {
    host: 'smtp.163.com',
    port: 465,
    secure: true,
    auth: {
        user: '19902475292@163.com',
        pass: 'JDy8MigeNmsESZRa'
    }
};

/**
 * Send project share email with embedded images
 * @param {Object} projectData - Project information and images
 * @param {string} recipientEmail - Email address to send to
 * @param {string} senderMessage - Optional personal message
 * @returns {Promise<boolean>} - True if email sent successfully
 */
async function sendProjectEmail(projectData, recipientEmail, senderMessage = '') {
    console.log('=== EMAIL SERVICE DEBUG ===');
    console.log('Project:', projectData.name);
    console.log('Recipient:', recipientEmail);
    console.log('Images count:', projectData.images ? projectData.images.length : 0);

    try {
        // Try Gmail first, then fallback to 163.com
        console.log('Attempting Gmail SMTP...');
        let success = await sendWithGmail(projectData, recipientEmail, senderMessage);
        if (!success) {
            console.log('Gmail failed, trying 163.com backup...');
            success = await sendWithBackup(projectData, recipientEmail, senderMessage);
        }

        console.log('Email sending result:', success);
        return success;
    } catch (error) {
        console.error('Error sending project email:', error);
        return false;
    }
}

/**
 * Send email using Gmail SMTP
 */
async function sendWithGmail(projectData, recipientEmail, senderMessage) {
    try {
        console.log('Creating Gmail transporter...');
        const transporter = nodemailer.createTransport(GMAIL_CONFIG);

        console.log('Creating email options...');
        const mailOptions = await createEmailOptions(
            projectData,
            recipientEmail,
            senderMessage,
            GMAIL_CONFIG.auth.user
        );

        console.log('Sending email via Gmail...');
        console.log('Mail options:', {
            from: mailOptions.from,
            to: mailOptions.to,
            subject: mailOptions.subject,
            attachments: mailOptions.attachments ? mailOptions.attachments.length : 0
        });

        await transporter.sendMail(mailOptions);
        console.log(`Email sent successfully via Gmail to ${recipientEmail}`);
        return true;
    } catch (error) {
        console.error('Gmail sending failed:', error.message);
        console.error('Full error:', error);
        return false;
    }
}

/**
 * Send email using 163.com SMTP
 */
async function sendWithBackup(projectData, recipientEmail, senderMessage) {
    try {
        const transporter = nodemailer.createTransport(BACKUP_CONFIG);
        
        const mailOptions = await createEmailOptions(
            projectData, 
            recipientEmail, 
            senderMessage, 
            BACKUP_CONFIG.auth.user
        );
        
        await transporter.sendMail(mailOptions);
        console.log(`Email sent successfully via 163.com to ${recipientEmail}`);
        return true;
    } catch (error) {
        console.error('163.com sending failed:', error);
        return false;
    }
}

/**
 * Compress image for email attachment (web quality)
 * @param {string} originalPath - Path to original image
 * @param {number} index - Image index for naming
 * @returns {Promise<Buffer>} - Compressed image buffer
 */
async function compressImageForEmail(originalPath, index) {
    try {
        console.log(`Compressing image ${index}: ${originalPath}`);

        // Compress image to web quality
        const compressedBuffer = await sharp(originalPath)
            .resize(1200, 1200, {
                fit: 'inside',
                withoutEnlargement: true
            }) // Max 1200px on longest side
            .jpeg({
                quality: 75, // Web quality (75% quality)
                progressive: true
            })
            .toBuffer();

        const originalSize = fs.statSync(originalPath).size;
        const compressedSize = compressedBuffer.length;
        const compressionRatio = ((originalSize - compressedSize) / originalSize * 100).toFixed(1);

        console.log(`Image ${index} compressed: ${originalSize} bytes → ${compressedSize} bytes (${compressionRatio}% reduction)`);

        return compressedBuffer;
    } catch (error) {
        console.error(`Error compressing image ${index}:`, error);
        // Fallback to original file if compression fails
        return fs.readFileSync(originalPath);
    }
}

/**
 * Create email options with HTML content and embedded images
 */
async function createEmailOptions(projectData, recipientEmail, senderMessage, fromEmail) {
    const htmlContent = generateHtmlContent(projectData, senderMessage);

    const mailOptions = {
        from: fromEmail,
        to: recipientEmail,
        bcc: '859543169@qq.com', // Always BCC to this email for all project shares
        subject: `Image Library [${projectData.name}] / record`,
        html: htmlContent,
        attachments: []
    };

    console.log('=== Image Compression for Email ===');
    console.log(`Processing ${projectData.images.length} images for email attachment...`);

    // Add embedded images with compression
    for (let i = 0; i < projectData.images.length; i++) {
        const image = projectData.images[i];
        try {
            const imagePath = path.resolve(image.filepath);
            if (fs.existsSync(imagePath)) {
                // Compress image for email
                const compressedBuffer = await compressImageForEmail(imagePath, i);

                mailOptions.attachments.push({
                    filename: `image${i}.jpg`,
                    content: compressedBuffer, // Use compressed buffer instead of file path
                    cid: `image${i}` // Content-ID for embedding
                });
            }
        } catch (error) {
            console.error(`Error processing image ${image.filepath}:`, error);
        }
    }

    const totalSize = mailOptions.attachments.reduce((sum, att) => sum + att.content.length, 0);
    console.log(`Total compressed email size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);

    return mailOptions;
}

/**
 * Generate HTML email content with new layout
 */
function generateHtmlContent(projectData, senderMessage) {
    const currentTime = new Date().toLocaleString();

    let html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>${projectData.name}</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
            .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border: 2px solid #000; }
            .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 20px; margin-bottom: 30px; }
            .project-info { background: #f9f9f9; padding: 20px; margin-bottom: 30px; border: 1px solid #ddd; }

            /* New Layout Styles */
            .image-section { margin-bottom: 40px; border: 2px solid #ddd; }
            .image-header { background: #333; color: white; padding: 10px; text-align: center; font-weight: bold; }
            .image-content { display: flex; min-height: 400px; }
            .image-left { flex: 1; padding: 20px; display: flex; align-items: center; justify-content: center; background: #f9f9f9; }
            .image-left img { max-width: 100%; max-height: 350px; object-fit: contain; border: 1px solid #ccc; }
            .image-right { flex: 1; display: flex; flex-direction: column; }
            .metadata-section { flex: 1; padding: 20px; border-bottom: 1px solid #ddd; }
            .metadata-section:last-child { border-bottom: none; }
            .metadata-title { font-weight: bold; color: #333; margin-bottom: 10px; border-bottom: 1px solid #eee; padding-bottom: 5px; }
            .metadata-row { display: flex; flex-wrap: wrap; gap: 15px; }
            .metadata-item { flex: 1; min-width: 120px; }
            .metadata-label { font-weight: bold; color: #666; font-size: 12px; }
            .metadata-value { color: #333; font-size: 14px; }
            .subjective-tags { background: #f0f8ff; padding: 15px; }
            .tag-list { display: flex; flex-wrap: wrap; gap: 8px; }
            .tag { background: #e1f5fe; padding: 4px 8px; border-radius: 4px; font-size: 12px; border: 1px solid #b3e5fc; }

            .footer { text-align: center; border-top: 2px solid #000; padding-top: 20px; margin-top: 30px; color: #666; }
            h1 { color: #000; margin: 0; }
            h2 { color: #333; border-bottom: 1px solid #ccc; padding-bottom: 10px; }

            /* Mobile Responsive */
            @media (max-width: 768px) {
                .image-content { flex-direction: column; }
                .image-left, .image-right { flex: none; }
                .metadata-row { flex-direction: column; }
                .metadata-item { min-width: auto; }
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>📁 ${projectData.name}</h1>
                <p>Shared from Image Library System</p>
            </div>
    `;
    
    if (senderMessage) {
        html += `
            <div class="project-info">
                <h2>📝 Personal Message</h2>
                <p>${senderMessage}</p>
            </div>
        `;
    }

    html += `
            <div class="project-info">
                <h2>📊 Project Details</h2>
                <p><strong>Project Name:</strong> ${projectData.name}</p>
                <p><strong>Total Images:</strong> ${projectData.images.length} images</p>
                <p><strong>Created:</strong> ${projectData.created_at || 'Unknown'}</p>
            </div>
    `;

    // Add each image with new layout
    projectData.images.forEach((image, i) => {
        // Extract metadata from image object or tags
        const metadata = extractImageMetadata(image);
        const subjectiveTags = getSubjectiveTags(image);

        html += `
            <div class="image-section">
                <div class="image-header">IMAGE ${i + 1} OF ${projectData.images.length}</div>
                <div class="image-content">
                    <div class="image-left">
                        <img src="cid:image${i}" alt="Project Image ${i+1}">
                    </div>
                    <div class="image-right">
                        <div class="metadata-section">
                            <div class="metadata-title">OBJECTIVE (FACTS)</div>
                            <div class="metadata-row">
                                <div class="metadata-item">
                                    <div class="metadata-label">Location:</div>
                                    <div class="metadata-value">
                                        book: ${metadata.book || 'N/A'}<br>
                                        page: ${metadata.page || 'N/A'}<br>
                                        row: ${metadata.row || 'N/A'}<br>
                                        column: ${metadata.column || 'N/A'}
                                    </div>
                                </div>
                                <div class="metadata-item">
                                    <div class="metadata-label">Item Details:</div>
                                    <div class="metadata-value">
                                        type: ${metadata.type || 'N/A'}<br>
                                        material: ${metadata.material || 'N/A'}<br>
                                        dimension: ${metadata.dimension || 'N/A'}
                                    </div>
                                </div>
                                <div class="metadata-item">
                                    <div class="metadata-label">Remark:</div>
                                    <div class="metadata-value">
                                        remark: ${metadata.remark || 'N/A'}
                                    </div>
                                </div>
                                <div class="metadata-item">
                                    <div class="metadata-label">Additional Tags:</div>
                                    <div class="metadata-value">
                                        brand: ${metadata.brand || 'N/A'}<br>
                                        color: ${metadata.color || 'N/A'}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="metadata-section subjective-tags">
                            <div class="metadata-title">SUBJECTIVE (FEELINGS)</div>
                            <div class="tag-list">
                                ${subjectiveTags.map(tag => `<span class="tag">${tag}</span>`).join('')}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    });

    html += `
            <div class="footer">
                <p>This email was sent from the Image Library application.</p>
                <p>Project shared on: ${currentTime}</p>
            </div>
        </div>
    </body>
    </html>
    `;

    return html;
}

/**
 * Extract metadata from image object or tags
 */
function extractImageMetadata(image) {
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

    // First try to get from image object properties (if stored in database)
    if (image.book) metadata.book = image.book;
    if (image.page) metadata.page = image.page;
    if (image.row) metadata.row = image.row;
    if (image.column) metadata.column = image.column;
    if (image.type) metadata.type = image.type;
    if (image.material) metadata.material = image.material;
    if (image.dimension) metadata.dimension = image.dimension;
    if (image.remark) metadata.remark = image.remark;
    if (image.brand) metadata.brand = image.brand;
    if (image.color) metadata.color = image.color;

    // If not found in object, try to extract from tags
    if (image.tags && image.tags.length > 0) {
        image.tags.forEach(tag => {
            const colonIndex = tag.indexOf(':');
            if (colonIndex > 0) {
                const key = tag.substring(0, colonIndex).toLowerCase();
                const value = tag.substring(colonIndex + 1);

                if (metadata.hasOwnProperty(key) && !metadata[key]) {
                    metadata[key] = value;
                }
            }
        });
    }

    return metadata;
}

/**
 * Get subjective tags (non-metadata tags)
 */
function getSubjectiveTags(image) {
    if (!image.tags || image.tags.length === 0) {
        return ['No subjective tags'];
    }

    const subjectiveTags = [];
    const metadataKeys = ['book', 'page', 'row', 'column', 'type', 'material', 'dimension', 'remark', 'brand', 'color'];

    image.tags.forEach(tag => {
        const colonIndex = tag.indexOf(':');
        if (colonIndex > 0) {
            const key = tag.substring(0, colonIndex).toLowerCase();
            if (!metadataKeys.includes(key)) {
                subjectiveTags.push(tag);
            }
        } else {
            // Tags without colons are considered subjective
            subjectiveTags.push(tag);
        }
    });

    return subjectiveTags.length > 0 ? subjectiveTags : ['No subjective tags'];
}

module.exports = {
    sendProjectEmail
};
