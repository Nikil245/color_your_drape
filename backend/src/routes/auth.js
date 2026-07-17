const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { db } = require('../config/firebase');
const { validateLogin, validateRegister, validateUpdateProfile, validateChangePassword } = require('../middleware/validate');
const authMiddleware = require('../middleware/auth');
require('dotenv').config();

const router = express.Router();

// Rate-limit the login endpoint to prevent brute force attempts
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 login requests per windowMs
  message: { error: 'Too many login attempts. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * POST /api/auth/login
 * Authenticate user with email + password, return JWT in httpOnly cookie.
 */
router.post('/login', loginLimiter, validateLogin, async (req, res) => {
  try {
    const { email, password } = req.body;

    // Look up user in Firestore
    const usersRef = db.collection('users');
    const snapshot = await usersRef.where('email', '==', email).limit(1).get();

    if (snapshot.empty) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const userDoc = snapshot.docs[0];
    const userData = userDoc.data();

    // Compare password with stored bcrypt hash
    const isMatch = await bcrypt.compare(password, userData.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Create JWT
    const token = jwt.sign(
      { uid: userDoc.id, email: userData.email, name: userData.name },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Set httpOnly cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    });

    return res.json({
      message: 'Login successful',
      user: { uid: userDoc.id, email: userData.email, name: userData.name },
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * POST /api/auth/register
 * Register a new admin user. Passwords hashed with bcrypt (saltRounds=10).
 */
router.post('/register', validateRegister, async (req, res) => {
  try {
    const { email, password, name } = req.body;

    // Check if user already exists
    const usersRef = db.collection('users');
    const snapshot = await usersRef.where('email', '==', email).limit(1).get();

    if (!snapshot.empty) {
      return res.status(400).json({ error: 'User with this email already exists.' });
    }

    // Hash password with bcrypt, saltRounds = 10
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Store user in Firestore
    const newUser = await usersRef.add({
      email,
      passwordHash,
      name,
      createdAt: new Date().toISOString(),
    });

    return res.status(201).json({
      message: 'User registered successfully.',
      user: { uid: newUser.id, email, name },
    });
  } catch (err) {
    console.error('Register error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * POST /api/auth/logout
 * Clear the httpOnly cookie.
 */
router.post('/logout', (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  });
  return res.json({ message: 'Logged out successfully.' });
});

/**
 * GET /api/auth/me
 * Return the currently authenticated user info (read from JWT cookie).
 */
router.get('/me', (req, res) => {
  const token = req.cookies?.token;
  if (!token) {
    return res.status(401).json({ error: 'Not authenticated.' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return res.json({ user: { uid: decoded.uid, email: decoded.email, name: decoded.name } });
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
});

/**
 * PUT /api/auth/profile
 * Update the authenticated user's name in Firestore and re-issue JWT.
 */
router.put('/profile', authMiddleware, validateUpdateProfile, async (req, res) => {
  try {
    const { name } = req.body;
    const uid = req.user.uid;

    await db.collection('users').doc(uid).update({ name });

    // Re-issue JWT with updated name so future /me calls are accurate
    const token = jwt.sign(
      { uid, email: req.user.email, name },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 24 * 60 * 60 * 1000,
    });

    return res.json({
      message: 'Profile updated successfully.',
      user: { uid, email: req.user.email, name },
    });
  } catch (err) {
    console.error('Update profile error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * POST /api/auth/change-password
 * Verify current password then hash and store the new one.
 */
router.post('/change-password', authMiddleware, validateChangePassword, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const uid = req.user.uid;

    const userDoc = await db.collection('users').doc(uid).get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const userData = userDoc.data();
    const isMatch = await bcrypt.compare(currentPassword, userData.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Current password is incorrect.' });
    }

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(newPassword, saltRounds);
    await db.collection('users').doc(uid).update({ passwordHash });

    return res.json({ message: 'Password changed successfully.' });
  } catch (err) {
    console.error('Change password error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
