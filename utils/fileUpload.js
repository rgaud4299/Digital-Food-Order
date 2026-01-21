const multer = require('multer');
const path = require('path');
const fs = require('fs');


function uploadImage(file, req, folder = "products") {
  if (!file || (!file.buffer && !file.path)) return "";

  const uploadDir = path.join(__dirname, "..", "uploads", folder);

  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const ext = path.extname(file.originalname || file.path).toLowerCase();
  const basename = path
    .basename(file.originalname || file.path, ext)
    .replace(/\s+/g, "-")
    .replace(/\.+/g, "_");

  const filename = `${Date.now()}-${basename}${ext}`;
  const filepath = path.join(uploadDir, filename);

  if (file.buffer) {
    fs.writeFileSync(filepath, file.buffer);
  } else if (file.path) {
    fs.copyFileSync(file.path, filepath);
  }
  
  return `${process.env.SERVER_URL}/uploads/${folder}/${filename}`;

  // return `${req.protocol}://${req.get("host")}/uploads/${folder}/${filename}`;
}


function deleteImageIfExists(imageUrl, req = null) {
  try {
    if (!imageUrl) return;

    // Default folder protect
    const DEFAULT_FOLDER_NAME = "default";

    // Base URL decide karo: req se ya environment variable se
    const baseUrl = req
      ? `${req.protocol}://${req.get("host")}`
      : (process.env.APP_URL || "").replace(/\/+$/, "");

    if (!baseUrl) {

      return;
    }

    // Image URL se domain/base URL hatao
    const relativePath = imageUrl.replace(baseUrl, "");

    // Extra leading slash handle karo
    const cleanPath = relativePath.replace(/^\/+/, "");

    // =====❗ CHECK IF DEFAULT FOLDER IMAGE =====
    if (cleanPath.startsWith(`uploads/${DEFAULT_FOLDER_NAME}/`)) {

      return;
    }

    // Actual filesystem path
    const fullPath = path.join(__dirname, "..", cleanPath);

    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);

    } else {

    }

  } catch (err) {

  }
}



const formDataToDB = (formData) => {
  const dbData = {};
  for (const [key, value] of formData.entries()) {
    // Skip files (Buffer objects)
    if (!(value instanceof Buffer)) {
      dbData[key] = value;
    }
  }
  return dbData;
}

const extractTextFields = (formData) => {
  const result = {};
  const streams = formData._streams;

  for (let i = 0; i < streams.length; i++) {
    const item = streams[i];

    // We look for the Content-Disposition line for a text field
    if (typeof item === 'string' && item.includes('Content-Disposition') && !item.includes('filename')) {
      // Extract the field name
      const match = item.match(/name="(.+?)"/);
      if (match) {
        const fieldName = match[1];
        // The next item in _streams is usually the value
        let value = streams[i + 1];
        if (typeof value === 'string') {
          result[fieldName] = value;
        }
      }
    }
  }
  return result;
};

module.exports = { uploadImage, deleteImageIfExists, formDataToDB, extractTextFields };
