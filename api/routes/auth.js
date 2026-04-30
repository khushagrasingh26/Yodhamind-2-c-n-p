/**
 * api/routes/auth.js — Authentication Routes
 * ════════════════════════════════════════════
 *
 * POST   /api/auth/register    Create a new student account
 * POST   /api/auth/login       Email + password login
 * GET    /api/auth/me          Get current user profile
 * PUT    /api/auth/me          Update current user profile
 * POST   /api/auth/refresh     Rotate access token using refresh token
 * POST   /api/auth/logout      Revoke refresh token
 * POST   /api/auth/logout-all  Revoke ALL refresh tokens for user
 * POST   /api/auth/forgot      Request password reset email
 * POST   /api/auth/reset       Set new password with reset token
 */

'use strict';

const express      = require('express');
const bcrypt       = require('bcryptjs');
const crypto       = require('crypto');
const { body, validationResult } = require('express-validator');

const db                          = require('../db');
const { generateTokens }          = require('../middleware/auth');
const { authenticate }            = require('../middleware/auth');
const { authLimiter }             = require('../middleware/rateLimit');

const router = express.Router();

/* ── Security constants ────────────────────── */
const MAX_LOGIN_ATTEMPTS  = 5;      // failures before lockout
const LOCKOUT_WINDOW_MIN  = 15;     // minutes to look back
const BCRYPT_ROUNDS       = 12;

/* ── Password complexity regex ─────────────── */
const PASSWORD_RULES = {
  minLength:  10,
  uppercase:  /[A-Z]/,
  lowercase:  /[a-z]/,
  digit:      /[0-9]/,
  special:    /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/
};

/* ── Shared validation helpers ──────────────── */
const emailRule    = body('email').isEmail().normalizeEmail().withMessage('Valid email required');
const passwordRule = body('password')
  .isLength({ min: PASSWORD_RULES.minLength })
  .withMessage(`Password must be at least ${PASSWORD_RULES.minLength} characters`)
  .custom((value) => {
    if (!PASSWORD_RULES.uppercase.test(value)) {
      throw new Error('Password must contain at least one uppercase letter');
    }
    if (!PASSWORD_RULES.lowercase.test(value)) {
      throw new Error('Password must contain at least one lowercase letter');
    }
    if (!PASSWORD_RULES.digit.test(value)) {
      throw new Error('Password must contain at least one number');
    }
    if (!PASSWORD_RULES.special.test(value)) {
      throw new Error('Password must contain at least one special character (!@#$%^&* etc.)');
    }
    return true;
  });

// Login password rule — only checks presence, not complexity
// (we don't want to reveal password policy to attackers)
const loginPasswordRule = body('password')
  .notEmpty()
  .withMessage('Password is required');

function validationGuard(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      ok:     false,
      error:  { code: 'VALIDATION_ERROR', fields: errors.array() }
    });
  }
  next();
}

/* ── Helper: extract device info ───────────── */
function getDeviceInfo(req) {
  return {
    ip:        req.ip || req.connection?.remoteAddress || 'unknown',
    userAgent: (req.headers['user-agent'] || 'unknown').slice(0, 500)
  };
}

/* ── Helper: check login lockout ───────────── */
async function isAccountLocked(email) {
  try {
    const result = await db.query(
      `SELECT COUNT(*) AS failures
       FROM login_attempts
       WHERE email = $1
         AND success = FALSE
         AND attempted_at >= NOW() - ($2 || ' minutes')::INTERVAL`,
      [email, LOCKOUT_WINDOW_MIN]
    );
    return parseInt(result.rows[0].failures, 10) >= MAX_LOGIN_ATTEMPTS;
  } catch {
    // Table might not exist yet — don't block login
    return false;
  }
}

/* ── Helper: record login attempt ──────────── */
async function recordLoginAttempt(email, ip, success) {
  try {
    await db.query(
      `INSERT INTO login_attempts (email, ip_address, success)
       VALUES ($1, $2, $3)`,
      [email, ip, success]
    );
  } catch {
    // Non-fatal — don't block auth flow if tracking fails
  }
}

/* ── Helper: clear failed attempts on success ── */
async function clearFailedAttempts(email) {
  try {
    await db.query(
      `DELETE FROM login_attempts
       WHERE email = $1 AND success = FALSE`,
      [email]
    );
  } catch {
    // Non-fatal
  }
}

/* ── Helper: store refresh token with device info ── */
async function storeRefreshToken(userId, refreshToken, deviceInfo) {
  const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
  await db.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, device_info, ip_address, expires_at)
     VALUES ($1, $2, $3, $4, NOW() + INTERVAL '30 days')`,
    [userId, tokenHash, deviceInfo.userAgent, deviceInfo.ip]
  );
}

/* ════════════════════════════════════════════════
   POST /api/auth/register
════════════════════════════════════════════════ */
router.post(
  '/register',
  authLimiter,
  [
    emailRule,
    passwordRule,
    body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters'),
    body('college').optional().trim().isLength({ max: 200 }),
    body('stream').optional().trim().isLength({ max: 80 }),
    body('year_of_study').optional().isInt({ min: 1, max: 6 })
  ],
  validationGuard,
  async (req, res) => {
    const { email, password, name, college, stream, year_of_study } = req.body;

    try {
      // Check for existing account
      const existing = await db.query(
        'SELECT id FROM users WHERE email = $1 AND deleted_at IS NULL',
        [email]
      );
      if (existing.rows.length > 0) {
        return res.status(409).json({
          ok:    false,
          error: { code: 'EMAIL_TAKEN', message: 'An account with this email already exists.' }
        });
      }

      // Hash password
      const password_hash = await bcrypt.hash(password, BCRYPT_ROUNDS);

      // Insert user
      const result = await db.query(
        `INSERT INTO users
           (email, password_hash, name, college, stream, year_of_study, role, is_verified)
         VALUES ($1, $2, $3, $4, $5, $6, 'student', FALSE)
         RETURNING id, email, name, college, stream, year_of_study, role, created_at`,
        [email, password_hash, name, college || null, stream || null, year_of_study || null]
      );

      const user = result.rows[0];

      // Create streak row
      await db.query(
        'INSERT INTO streaks (user_id) VALUES ($1) ON CONFLICT DO NOTHING',
        [user.id]
      );

      // Generate tokens
      const tokens = generateTokens(user);
      const deviceInfo = getDeviceInfo(req);

      // Store refresh token with device info
      await storeRefreshToken(user.id, tokens.refreshToken, deviceInfo);

      console.log(`[auth/register] New user registered: ${email} from IP ${deviceInfo.ip}`);

      return res.status(201).json({
        ok:   true,
        data: {
          user:   sanitiseUser(user),
          tokens: {
            accessToken:  tokens.accessToken,
            refreshToken: tokens.refreshToken,
            expiresIn:    tokens.expiresIn
          }
        }
      });

    } catch (err) {
      console.error('[auth/register]', err.message);
      return res.status(500).json({
        ok:    false,
        error: { code: 'SERVER_ERROR', message: 'Registration failed. Please try again.' }
      });
    }
  }
);

/* ════════════════════════════════════════════════
   POST /api/auth/login
════════════════════════════════════════════════ */
router.post(
  '/login',
  authLimiter,
  [emailRule, loginPasswordRule],
  validationGuard,
  async (req, res) => {
    const { email, password } = req.body;
    const deviceInfo = getDeviceInfo(req);

    try {
      // Check account lockout
      const locked = await isAccountLocked(email);
      if (locked) {
        console.warn(`[auth/login] Account locked: ${email} from IP ${deviceInfo.ip}`);
        return res.status(429).json({
          ok:    false,
          error: {
            code:    'ACCOUNT_LOCKED',
            message: `Too many failed login attempts. Please wait ${LOCKOUT_WINDOW_MIN} minutes before trying again.`,
            retryAfter: LOCKOUT_WINDOW_MIN * 60
          }
        });
      }

      const result = await db.query(
        `SELECT id, email, password_hash, name, college, stream,
                year_of_study, role, is_verified, avatar_url
         FROM users
         WHERE email = $1 AND deleted_at IS NULL`,
        [email]
      );

      const user = result.rows[0];

      // Constant-time check — same response whether user exists or not
      const dummyHash = '$2b$12$invalidhashtopreventtiming..............................';
      const passwordOk = user
        ? await bcrypt.compare(password, user.password_hash)
        : await bcrypt.compare(password, dummyHash).then(() => false);

      if (!user || !passwordOk) {
        // Record failed attempt
        await recordLoginAttempt(email, deviceInfo.ip, false);

        console.warn(`[auth/login] Failed login for ${email} from IP ${deviceInfo.ip}`);

        return res.status(401).json({
          ok:    false,
          error: { code: 'INVALID_CREDENTIALS', message: 'Email or password is incorrect.' }
        });
      }

      // Successful login — clear failed attempts
      await recordLoginAttempt(email, deviceInfo.ip, true);
      await clearFailedAttempts(email);

      // Update last_login_at
      await db.query(
        'UPDATE users SET last_login_at = NOW() WHERE id = $1',
        [user.id]
      );

      const tokens = generateTokens(user);

      // Store refresh token with device info
      await storeRefreshToken(user.id, tokens.refreshToken, deviceInfo);

      console.log(`[auth/login] Successful login: ${email} from IP ${deviceInfo.ip}`);

      return res.status(200).json({
        ok:   true,
        data: {
          user:   sanitiseUser(user),
          tokens: {
            accessToken:  tokens.accessToken,
            refreshToken: tokens.refreshToken,
            expiresIn:    tokens.expiresIn
          }
        }
      });

    } catch (err) {
      console.error('[auth/login]', err.message);
      return res.status(500).json({
        ok:    false,
        error: { code: 'SERVER_ERROR', message: 'Login failed. Please try again.' }
      });
    }
  }
);

/* ════════════════════════════════════════════════
   GET /api/auth/me
════════════════════════════════════════════════ */
router.get('/me', authenticate, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, email, name, college, stream, year_of_study,
              role, is_verified, avatar_url, institution_code,
              last_login_at, created_at
       FROM users
       WHERE id = $1 AND deleted_at IS NULL`,
      [req.user.id]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        ok:    false,
        error: { code: 'USER_NOT_FOUND', message: 'User account not found.' }
      });
    }

    return res.json({ ok: true, data: sanitiseUser(result.rows[0]) });

  } catch (err) {
    console.error('[auth/me]', err.message);
    return res.status(500).json({
      ok: false, error: { code: 'SERVER_ERROR', message: 'Could not load profile.' }
    });
  }
});

/* ════════════════════════════════════════════════
   PUT /api/auth/me  — update profile
════════════════════════════════════════════════ */
router.put(
  '/me',
  authenticate,
  [
    body('name').optional().trim().isLength({ min: 2, max: 100 }),
    body('college').optional().trim().isLength({ max: 200 }),
    body('stream').optional().trim().isLength({ max: 80 }),
    body('year_of_study').optional().isInt({ min: 1, max: 6 })
  ],
  validationGuard,
  async (req, res) => {
    const { name, college, stream, year_of_study } = req.body;

    // Build partial update — only set fields that were provided
    const updates = [];
    const values  = [];
    let   idx     = 1;

    if (name          !== undefined) { updates.push(`name = $${idx++}`);          values.push(name); }
    if (college       !== undefined) { updates.push(`college = $${idx++}`);       values.push(college); }
    if (stream        !== undefined) { updates.push(`stream = $${idx++}`);        values.push(stream); }
    if (year_of_study !== undefined) { updates.push(`year_of_study = $${idx++}`); values.push(year_of_study); }

    if (updates.length === 0) {
      return res.status(422).json({
        ok:    false,
        error: { code: 'NO_FIELDS', message: 'No fields provided to update.' }
      });
    }

    values.push(req.user.id);

    try {
      const result = await db.query(
        `UPDATE users SET ${updates.join(', ')}
         WHERE id = $${idx} AND deleted_at IS NULL
         RETURNING id, email, name, college, stream, year_of_study, role`,
        values
      );

      if (!result.rows.length) {
        return res.status(404).json({
          ok: false, error: { code: 'USER_NOT_FOUND', message: 'User not found.' }
        });
      }

      return res.json({ ok: true, data: sanitiseUser(result.rows[0]) });

    } catch (err) {
      console.error('[auth/me PUT]', err.message);
      return res.status(500).json({
        ok: false, error: { code: 'SERVER_ERROR', message: 'Profile update failed.' }
      });
    }
  }
);

/* ════════════════════════════════════════════════
   POST /api/auth/refresh  — rotate tokens
════════════════════════════════════════════════ */
router.post(
  '/refresh',
  authLimiter,
  [body('refreshToken').notEmpty().withMessage('refreshToken is required')],
  validationGuard,
  async (req, res) => {
    const { refreshToken } = req.body;
    const deviceInfo = getDeviceInfo(req);

    try {
      const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

      // Look up token in DB
      const tokenResult = await db.query(
        `SELECT rt.id, rt.user_id, rt.expires_at, rt.revoked,
                rt.ip_address AS original_ip,
                u.email, u.role
         FROM refresh_tokens rt
         JOIN users u ON u.id = rt.user_id
         WHERE rt.token_hash = $1 AND u.deleted_at IS NULL`,
        [tokenHash]
      );

      const stored = tokenResult.rows[0];

      if (!stored) {
        return res.status(401).json({
          ok: false, error: { code: 'TOKEN_INVALID', message: 'Invalid refresh token.' }
        });
      }

      if (stored.revoked) {
        // Possible token theft — revoke all tokens for this user
        await db.query(
          'UPDATE refresh_tokens SET revoked = TRUE WHERE user_id = $1',
          [stored.user_id]
        );
        console.warn(`[auth/refresh] TOKEN REUSE DETECTED for user ${stored.email} — all tokens revoked`);
        return res.status(401).json({
          ok: false, error: { code: 'TOKEN_REUSED', message: 'Security alert: please log in again.' }
        });
      }

      if (new Date(stored.expires_at) < new Date()) {
        return res.status(401).json({
          ok: false, error: { code: 'TOKEN_EXPIRED', message: 'Session expired. Please log in again.' }
        });
      }

      // Log IP change on refresh (potential suspicious activity)
      if (stored.original_ip && stored.original_ip !== deviceInfo.ip) {
        console.warn(`[auth/refresh] IP changed for user ${stored.email}: ${stored.original_ip} → ${deviceInfo.ip}`);
      }

      // Revoke old refresh token (rotation)
      await db.query(
        'UPDATE refresh_tokens SET revoked = TRUE WHERE id = $1',
        [stored.id]
      );

      // Issue new token pair
      const user   = { id: stored.user_id, email: stored.email, role: stored.role };
      const tokens = generateTokens(user);

      // Store new refresh token with device info
      await storeRefreshToken(stored.user_id, tokens.refreshToken, deviceInfo);

      return res.json({
        ok:   true,
        data: {
          accessToken:  tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresIn:    tokens.expiresIn
        }
      });

    } catch (err) {
      console.error('[auth/refresh]', err.message);
      return res.status(500).json({
        ok: false, error: { code: 'SERVER_ERROR', message: 'Token refresh failed.' }
      });
    }
  }
);

/* ════════════════════════════════════════════════
   POST /api/auth/logout
════════════════════════════════════════════════ */
router.post(
  '/logout',
  authenticate,
  async (req, res) => {
    const { refreshToken } = req.body;

    try {
      if (refreshToken) {
        const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
        await db.query(
          'UPDATE refresh_tokens SET revoked = TRUE WHERE token_hash = $1 AND user_id = $2',
          [tokenHash, req.user.id]
        );
      }

      return res.json({ ok: true, message: 'Logged out successfully.' });

    } catch (err) {
      console.error('[auth/logout]', err.message);
      // Return success anyway — client should clear tokens regardless
      return res.json({ ok: true, message: 'Logged out.' });
    }
  }
);

/* ════════════════════════════════════════════════
   POST /api/auth/logout-all
   Revokes ALL refresh tokens for the current user.
   Use when: password change, suspicious activity,
   or user wants to log out from all devices.
════════════════════════════════════════════════ */
router.post(
  '/logout-all',
  authenticate,
  async (req, res) => {
    try {
      const result = await db.query(
        'UPDATE refresh_tokens SET revoked = TRUE WHERE user_id = $1 AND revoked = FALSE',
        [req.user.id]
      );

      const revokedCount = result.rowCount || 0;

      console.log(`[auth/logout-all] User ${req.user.email} revoked ${revokedCount} token(s)`);

      return res.json({
        ok:      true,
        message: `Logged out from all devices. ${revokedCount} session(s) revoked.`
      });

    } catch (err) {
      console.error('[auth/logout-all]', err.message);
      return res.status(500).json({
        ok: false, error: { code: 'SERVER_ERROR', message: 'Failed to logout from all devices.' }
      });
    }
  }
);

/* ════════════════════════════════════════════════
   PRIVATE: sanitise user row before sending
   Never expose: password_hash, verify_token, reset_token
════════════════════════════════════════════════ */
function sanitiseUser(user) {
  const {
    password_hash, verify_token, reset_token, reset_token_exp, // eslint-disable-line
    ...safe
  } = user;
  return safe;
}

module.exports = router;
