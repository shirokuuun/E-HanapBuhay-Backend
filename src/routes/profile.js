const express = require("express");
const router = express.Router();
const { authenticate } = require("../middleware/auth");
const upload = require("../middleware/upload");
const {
  getProfile,
  updateProfile,
  updateAvatar,
  updateDocuments,
  getDocuments,
} = require("../controllers/profileController");

const avatarUpload = require("multer")({
  storage: require("multer").diskStorage({
    destination: (req, file, cb) => {
      const fs = require("fs");
      const dir = require("path").join(__dirname, "../../uploads/avatars");
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      const ext = require("path").extname(file.originalname);
      cb(null, `${req.user.id}-avatar${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only image files allowed"), false);
  },
});

const documentUpload = require("multer")({
  storage: require("multer").diskStorage({
    destination: (req, file, cb) => {
      const fs = require("fs");
      const dir = require("path").join(__dirname, "../../uploads/documents");
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      const ext = require("path").extname(file.originalname);
      const base = require("path")
        .basename(file.originalname, ext)
        .replace(/[^a-zA-Z0-9-_]/g, "_");
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

router.get("/", authenticate, getProfile);
router.put("/", authenticate, updateProfile);
router.post(
  "/avatar",
  authenticate,
  avatarUpload.single("avatar"),
  updateAvatar,
);
router.post(
  "/documents",
  authenticate,
  documentUpload.fields([
    { name: "resume", maxCount: 1 },
    { name: "cover_letter", maxCount: 1 },
  ]),
  updateDocuments,
);
router.get("/documents", authenticate, getDocuments);

// ── Routes ───────────────────────────────────────────────────────────────────

// GET  /api/user/profile/:id  → fetch user + business profile
router.get('/profile/:id', getProfile);

// PUT  /api/user/profile/:id  → update full_name / location / phone_number
router.put('/profile/:id', authenticate, updateProfile);

// PUT  /api/user/business/:id → upsert business_profiles row
router.put('/business/:id', authenticate, updateBusiness);

// POST /api/user/avatar       → upload avatar image (uses req.user.id from JWT)
router.post('/avatar', authenticate, avatarUpload.single('avatar'), updateAvatar);

// POST /api/user/permit/:id   → upload business permit PDF
router.post('/permit/:id', authenticate, permitUpload.single('permit'), updatePermit);

module.exports = router;