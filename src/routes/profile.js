const express = require("express");
const router  = express.Router();
const path    = require("path");
const fs      = require("fs");
const multer  = require("multer");
const { authenticate } = require("../middleware/auth");
const {
  getProfile,
  getMyProfile,
  updateProfile,
  updateBusiness,
  updateAvatar,
  updatePermit,
  updateDocuments,
  getDocuments,
} = require("../controllers/profileController");

// ── Multer: Avatar ────────────────────────────────────────────────────────────
const avatarUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const dir = path.join(__dirname, "../../uploads/avatars");
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `${req.user.id}-avatar${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only image files allowed"), false);
  },
});

// ── Multer: Documents ─────────────────────────────────────────────────────────
const documentUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const dir = path.join(__dirname, "../../uploads/documents");
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      const ext  = path.extname(file.originalname);
      const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9-_]/g, "_");
      cb(null, `${req.user.id}-${file.fieldname}-${base}${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Only PDF and Word documents allowed"), false);
  },
});

// ── Multer: Business Permit ───────────────────────────────────────────────────
const permitUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const dir = path.join(__dirname, "../../uploads/permits");
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      cb(null, `${req.params.id}-permit-${Date.now()}.pdf`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/pdf") cb(null, true);
    else cb(new Error("Only PDF files allowed"), false);
  },
});

// ── Routes ────────────────────────────────────────────────────────────────────

// GET  /api/user/profile        → fetch profile for logged-in user (token-based)
router.get("/profile",    authenticate, getMyProfile);

// GET  /api/user/profile/:id    → fetch profile by explicit user ID
router.get("/profile/:id", getProfile);

// PUT  /api/user/profile        → update own profile (token-based)
router.put("/profile",    authenticate, updateProfile);

// PUT  /api/user/profile/:id    → update profile by explicit user ID
router.put("/profile/:id", authenticate, updateProfile);

// PUT  /api/user/business/:id   → upsert business_profiles row
router.put("/business/:id", authenticate, updateBusiness);

// POST /api/user/avatar         → upload avatar image
router.post("/avatar", authenticate, avatarUpload.single("avatar"), updateAvatar);

// POST /api/user/permit/:id     → upload business permit PDF
router.post("/permit/:id", authenticate, permitUpload.single("permit"), updatePermit);

// POST /api/user/documents      → upload resume and/or cover letter
router.post(
  "/documents",
  authenticate,
  documentUpload.fields([
    { name: "resume",       maxCount: 1 },
    { name: "cover_letter", maxCount: 1 },
  ]),
  updateDocuments
);

// GET  /api/user/documents      → fetch document URLs for the logged-in user
router.get("/documents", authenticate, getDocuments);

module.exports = router;