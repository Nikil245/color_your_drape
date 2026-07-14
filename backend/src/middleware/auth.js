const jwt = require('jsonwebtoken');
require('dotenv').config();

/**
 * Middleware to verify JWT from httpOnly cookie.
 * Rejects unauthenticated requests with 401.
 */
const authMiddleware = (req, res, next) => {
  const token = req.cookies?.token;

  if (!token) {
    return res.status(401).json({ error: 'Authentication required. Please sign in.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token. Please sign in again.' });
  }
};

module.exports = authMiddleware;
