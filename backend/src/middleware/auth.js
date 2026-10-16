const jwt = require('jsonwebtoken');
require('dotenv').config();

/**
 * Middleware to verify JWT from httpOnly cookie.
 * Rejects unauthenticated requests with 401.
 */
const authMiddleware = (req, res, next) => {
  let token = req.cookies?.token;
  
  if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ error: 'Authentication required. Please sign in.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if ((decoded.dataScope !== 'real' && decoded.dataScope !== 'demo')
      || decoded.isDemo !== (decoded.dataScope === 'demo')) {
      return res.status(401).json({ error: 'Session scope is missing or invalid. Please sign in again.' });
    }
    req.user = decoded;
    req.dataScope = decoded.dataScope;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token. Please sign in again.' });
  }
};

module.exports = authMiddleware;
