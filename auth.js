const jwt = require("jsonwebtoken");
const User = require("../models/User");

/**
 * Verifies the JWT, loads the user, and attaches req.user + req.schoolId.
 * req.schoolId is the single source of truth every route uses to scope
 * queries — a school_admin/teacher can never see another school's data
 * because every query filters by this value, taken from the token's own
 * user record (not from anything the client sends).
 */
async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const headerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  // Plain <a href> download links (opened in a new tab) can't set a custom
  // Authorization header, so PDF endpoints are reached that way instead —
  // this is why a query-param fallback exists specifically for those.
  // Trade-off, noted honestly in the README: the token briefly appears in
  // the URL (and so potentially in server access logs) for this request.
  const token = headerToken || req.query.token || null;

  if (!token) {
    return res.status(401).json({ error: "Missing Authorization header." });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.userId);
    if (!user || !user.isActive) {
      return res.status(401).json({ error: "Invalid or inactive user." });
    }
    req.user = user;
    req.schoolId = user.schoolId; // null for super_admin
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token." });
  }
}

/**
 * Restricts a route to specific roles. Use after requireAuth.
 * e.g. requireRole("school_admin") or requireRole("school_admin", "teacher")
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: "You don't have permission to do that." });
    }
    next();
  };
}

/**
 * Every non-super_admin route needs a schoolId to scope by. This guards
 * against a super_admin token hitting a school-scoped route without
 * specifying which school (super_admin routes are separate/limited for now).
 */
function requireSchoolContext(req, res, next) {
  if (!req.schoolId) {
    return res.status(400).json({ error: "This action requires a school-scoped account." });
  }
  next();
}

module.exports = { requireAuth, requireRole, requireSchoolContext };
