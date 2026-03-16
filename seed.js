// server/seedAdmin.js
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

const seedAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Check if admin already exists
    const existingAdmin = await User.findOne({ email: 'admin@proposal.com' });

    if (existingAdmin) {
      console.log('Admin user already exists → skipping creation');
      process.exit(0);
    }

    // Create new admin
    const admin = await User.create({
      email: 'admin@proposal.com',
      password: 'admin123',       
      role: 'admin'
    });

    console.log('Admin user created successfully:');
    console.log('Email   :', admin.email);
    console.log('Password:', admin.password);
    console.log('ID      :', admin._id);

  } catch (error) {
    console.error('Error seeding admin:', error.message);
  } finally {
    mongoose.connection.close();
    console.log('Connection closed');
  }
};

seedAdmin();