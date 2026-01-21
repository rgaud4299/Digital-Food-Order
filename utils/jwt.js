const jwt = require('jsonwebtoken');
const { convertBigIntToString } = require('./parser');


const generateToken = (payload, expiresIn = process.env.JWT_EXPIRES_IN || '8h') => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not defined in environment variables');
  }

  payload = convertBigIntToString(payload)
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn });
};

const verifyToken = (token) => {
  if (!process.env.JWT_SECRET) {
    console.error('JWT_SECRET is not defined in environment variables');
    return null;
  }

  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    console.error('JWT verification failed :', err.message);
    return null;
  }
};

module.exports = {
  generateToken,
  verifyToken,
};

