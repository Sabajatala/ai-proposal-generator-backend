const mongoose = require('mongoose');

const proposalSchema = new mongoose.Schema({

  title: {
    type: String,
    default: function () {
      return `Proposal for ${this.clientName || 'Client'}`;
    }
  },
  clientName: {
    type: String,
    required: true,
    trim: true
  },
  clientEmail: {
    type: String,
    trim: true
  },
  clientIndustry: {
    type: String,
    trim: true,
    default: ''
  },


  projectType: String,
  budget: Number,
  requirements: String,


  company: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company'
  },

  
  aiContent: {
    type: Object,
    default: {}
  },


  status: {
    type: String,
    enum: ['Draft', 'Sent', 'Accepted', 'Rejected'],
    default: 'Draft'
  },
  pdfUrl: {
    type: String,
    default: ''
  },

  
  paymentTerms: {
    type: String,
    default: ''
  },

  
  versions: [{
    versionNumber: Number,
    aiContent: Object,
    createdAt: Date
  }],

  
  chatHistory: [{
    message: String,
    isAdmin: Boolean,
    createdAt: Date
  }]
}, {
  timestamps: true
});

module.exports = mongoose.model('Proposal', proposalSchema);