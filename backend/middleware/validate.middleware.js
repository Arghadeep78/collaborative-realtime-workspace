// Lightweight request-body validation.
//
// Each route passes a `rules` object mapping a field name to a check function.
// A check returns null when the value is valid, or an error string describing
// what was expected. `validate` collects all failures and rejects with 400
// before the controller runs, so controllers can trust their input.

import validator from "validator";

// Both bounds use the trimmed length so whitespace padding doesn't affect limits.
const isStr = (v, min = 1, max = 256) =>
  typeof v === "string" && v.trim().length >= min && v.trim().length <= max;

const isOneOf = (v, allowed) => allowed.includes(v);

export const validate = (rules) => (req, res, next) => {
  const errors = [];
  for (const [field, check] of Object.entries(rules)) {
    const msg = check((req.body ?? {})[field]);
    if (msg) errors.push(`${field}: ${msg}`);
  }
  if (errors.length) {
    return res.status(400).json({ message: errors.join("; ") });
  }
  next();
};

const SHARE_ROLES = ["viewer", "commenter", "editor"];

// Reusable field checks. Wrap presence-optional fields with `optional`.
export const fields = {
  name: (v) => (isStr(v, 1, 100) ? null : "must be 1–100 characters"),
  email: (v) => (typeof v === "string" && validator.isEmail(v) ? null : "must be a valid email"),
  password: (v) => (isStr(v, 8, 128) ? null : "must be 8–128 characters"),
  // For verifying an EXISTING credential (e.g. oldPassword): only require it to
  // be present. The model checks it against the hash; applying the new-password
  // length rule here could lock users out if the policy ever tightens.
  required: (v) => (isStr(v, 1, 256) ? null : "is required"),
  role: (v) =>
    isOneOf(v, ["admin", "user"]) ? null : "must be 'admin' or 'user'",
  // Project/workspace sharing & publishing roles.
  shareRole: (v) =>
    isOneOf(v, SHARE_ROLES) ? null : `must be one of ${SHARE_ROLES.join(", ")}`,
  // Free-text fields a user types: title, workspace name, project id, etc.
  title: (v) => (isStr(v, 1, 200) ? null : "must be 1–200 characters"),
  projectId: (v) => (isStr(v, 1, 200) ? null : "is required"),
};

// Allow a field to be absent, but validate it when present.
export const optional = (check) => (v) =>
  v == null ? null : check(v);
