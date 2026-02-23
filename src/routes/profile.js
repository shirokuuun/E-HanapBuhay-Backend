const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { getProfile, updateProfile, updateAvatar } = require('../controllers/profileController');

const avatarUpload = require('multer')({
  storage: require('multer').diskStorage({
    destination: (req, file, cb) => {
      const fs = require('fs');
      const dir = require('path').join(__dirname, '../../uploads/avatars');
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      const ext = require('path').extname(file.originalname);
      cb(null, `${req.user.id}-avatar${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files allowed'), false);
  },
});

router.get('/',          authenticate, getProfile);
router.put('/',          authenticate, updateProfile);
router.post('/avatar',   authenticate, avatarUpload.single('avatar'), updateAvatar);

module.exports = router;
