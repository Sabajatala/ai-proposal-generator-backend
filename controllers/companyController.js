const Company = require('../models/Company');
const cloudinary = require('../utils/cloudinary');
const multer = require('multer');

const upload = multer({ storage: multer.memoryStorage() });

exports.getCompany = async (req, res) => {
  let company = await Company.findOne();
  if (!company) company = await Company.create({ name: 'Your Company Name' });
  res.json({ success: true, data: company });
};

exports.updateCompany = async (req, res) => {
  try {
    const { name, skills, teamSize, experience, description, specialization } = req.body;
    let logoUrl = req.body.logoUrl;

    if (req.file) {
      const result = await new Promise((resolve, reject) => {
        cloudinary.uploader.upload_stream(
          { folder: 'proposal-app/company-logos' },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        ).end(req.file.buffer);
      });
      logoUrl = result.secure_url;
    }

    const company = await Company.findOneAndUpdate(
      {},
      {
        name,
        logoUrl,
        skills: skills ? skills.split(',').map(s => s.trim()) : [],
        teamSize: Number(teamSize),
        experience: Number(experience),
        description,
        specialization
      },
      { upsert: true, new: true }
    );

    res.json({ success: true, data: company });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.uploadMiddleware = upload.single('logo');