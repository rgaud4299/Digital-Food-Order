const crypto = require("crypto");

// derive a 32-byte key safely
const password = process.env.ENCRYPTION_SECRET_KEY || "my_password_key";
const SECRET_KEY = crypto.scryptSync(password, "salt", 32); 
const IV_LENGTH = 16;

// Encrypt function
exports.encryptData = (text) => {
  try {
        const input = text.toString(); // ✅ Convert bigint, number, etc. to string

    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv("aes-256-cbc", SECRET_KEY, iv);
    let encrypted = cipher.update(input, "utf8", "base64");
    encrypted += cipher.final("base64");
    console.log("Encryption:", iv.toString("base64") + ":" + encrypted);
    
    return iv.toString("base64") + ":" + encrypted;
  } catch (err) {
    console.error("Encryption Error:", err);
    return null;
  }
};

// Decrypt function
exports.decryptData = (encryptedText) => {
  try {
    const [ivBase64, encrypted] = encryptedText.split(":");
    const iv = Buffer.from(ivBase64, "base64");
    const decipher = crypto.createDecipheriv("aes-256-cbc", SECRET_KEY, iv);
    let decrypted = decipher.update(encrypted, "base64", "utf8");
    decrypted += decipher.final("utf8");
    console.log('decrypted',decrypted);
    
    return decrypted;
  } catch (err) {
    console.error("Decryption Error:", err);
    return null;
  }
};
