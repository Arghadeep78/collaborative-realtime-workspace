import multer from "multer";

const storage = multer.diskStorage({
        destination: (req, file, cb) => cb(null, "uploads/"),
        filename: (req, file, cb) =>
            cb(null, Date.now() + "-" + file.originalname),
    });

export const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowed = /image|video|audio/;
        if (!allowed.test(file.mimetype)) {
            return cb(new Error('Only image, video, and audio files are allowed'));
        }
        cb(null, true);
    },
});
