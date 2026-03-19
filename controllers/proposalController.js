const axios = require('axios');
const Proposal = require('../models/Proposal');
const Company = require('../models/Company');
const { generateAndUploadPdf } = require('../utils/generatePdf');



exports.generateProposal = async (req, res) => {
  try {
  
    const company = await Company.findOne();
    if (!company) {
      return res.status(400).json({
        success: false,
        error: 'Company profile not found. Please complete company profile first.'
      });
    }

    
    const {
      clientName,
      clientEmail,
      clientIndustry = '',
      projectType,
      budget,
      requirements
    } = req.body;

    
    const payloadForAI = {
      clientName,
      clientEmail,
      clientIndustry,
      projectType,
      budget: Number(budget) || 0,
      requirements,
      companyProfile: {
        name: company.name,
        logoUrl: company.logoUrl,
        skills: company.skills,
        teamSize: company.teamSize,
        experience: company.experience,
        description: company.description,
        specialization: company.specialization
      }
    };

    
    let aiContent;
    try {
      const aiResponse = await axios.post(
        `${process.env.AI_API_URL}/generate_draft`, 
        payloadForAI,
        { timeout: 900000 } 
      );

      aiContent = aiResponse.data;

      
      if (!aiContent.introduction) {
        aiContent.introduction = `Dear ${clientName}, thank you for your interest...`;
      }
      
    } catch (aiError) {
      console.error('AI API error:', aiError.message);
      
      aiContent = {
        introduction: `Dear ${clientName},\n\nWe are excited to present this proposal...`,
        understanding: `We understand your requirements: ${requirements || 'Not specified'}`,
        scopeOfWork: requirements || "Custom scope to be defined",
        timeline: "6 weeks (adjustable based on scope)",
        pricing: `Estimated total: $${Math.round(Number(budget || 0) * 1.25)}`,
        planType: "Standard",
        closing: "We look forward to partnering with you!",
        projectFeasibility: `This project is feasible for our team with ${company.teamSize} members and ${company.experience}+ years experience.`
      };
    }

    
    const newProposal = await Proposal.create({
      title: `Proposal for ${clientName}`,
      clientName,
      clientEmail,
      clientIndustry,
      projectType,
      budget: Number(budget) || 0,
      requirements,
      company: company._id,
      aiContent, 
      paymentTerms: "50% upfront, 30% on milestone, 20% on completion",
      status: 'Draft',
      versions: [{
        versionNumber: 1,
        aiContent,
        createdAt: new Date()
      }],
      chatHistory: []
    });

    
    res.json({
      success: true,
      message: 'Proposal draft created successfully',
      data: newProposal
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// exports.generateProposal = async (req, res) => {
//   try {
//     const company = await Company.findOne();
//     if (!company) {
//       return res.status(400).json({
//         success: false,
//         error: 'Company profile not found. Please complete company profile first.'
//       });
//     }

//     const {
//       clientName,
//       clientEmail,
//       clientIndustry = '',
//       projectType,
//       budget,
//       requirements
//     } = req.body;

//     // Dummy AI response – this will be replaced with real Python API call later
//     const dummyAiContent = {
//       introduction: `Dear ${clientName},\n\nWe are excited to present this proposal for your ${projectType || 'project'} needs in the ${clientIndustry || 'industry'}.`,
//       understanding: `We understand your requirements: ${requirements || 'Not specified'}`,
//       scopeOfWork: requirements || "Custom scope to be defined",
//       timeline: "6 weeks (adjustable based on scope)",
//       pricing: `Estimated total: PKR${Math.round(Number(budget || 0) * 1.25)}`,
//       priceBreakdown: [
//         { item: "Development", amount: `PKR${Math.round(Number(budget || 0) * 0.6)}` },
//         { item: "Design & Testing", amount: `PKR${Math.round(Number(budget || 0) * 0.3)}` },
//         { item: "Project Management", amount: `PKR${Math.round(Number(budget || 0) * 0.1)}` }
//       ],
//       planType: "Standard",
//       closing: "We look forward to partnering with you!",
//       projectFeasibility: `This project is fully feasible for our team. With ${company.teamSize} team members and ${company.experience}+ years of experience in ${company.specialization.toLowerCase()}, we can handle the requirements confidently.`
//     };

//     const newProposal = await Proposal.create({
//       title: `Proposal for ${clientName}`,
//       clientName,
//       clientEmail,
//       clientIndustry,
//       projectType,
//       budget: Number(budget) || 0,
//       requirements,
//       company: company._id,
//       aiContent: dummyAiContent,
//       paymentTerms: "50% upfront, 30% on milestone, 20% on completion",
//       status: 'Draft',
//       versions: [{
//         versionNumber: 1,
//         aiContent: dummyAiContent,
//         createdAt: new Date()
//       }],
//       chatHistory: []
//     });

//     res.json({
//       success: true,
//       message: 'Proposal draft created successfully',
//       data: newProposal
//     });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ success: false, error: err.message });
//   }
// };

exports.getProposals = async (req, res) => {
  try {
    const proposals = await Proposal.find()
      .populate('company', 'name logoUrl')
      .sort({ createdAt: -1 });
    res.json({ success: true, count: proposals.length, data: proposals });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};


exports.getProposalById = async (req, res) => {
  try {
    const proposal = await Proposal.findById(req.params.id)
      .populate('company', 'name logoUrl skills teamSize experience description specialization');

    if (!proposal) {
      return res.status(404).json({
        success: false,
        error: 'Proposal not found'
      });
    }

    res.json({
      success: true,
      data: proposal
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      error: err.message || 'Server error'
    });
  }
};


exports.deleteProposal = async (req, res) => {
  try {
    const proposal = await Proposal.findById(req.params.id);

    if (!proposal) {
      return res.status(404).json({ success: false, error: 'Proposal not found' });
    }

  
    if (proposal.status !== 'Draft') {
      return res.status(403).json({ success: false, error: 'Can only delete Draft proposals' });
    }

    await Proposal.findByIdAndDelete(req.params.id);

    res.json({ success: true, message: 'Proposal deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};



exports.chatEdit = async (req, res) => {
  try {
    const { id } = req.params;
    const { message } = req.body;

    const proposal = await Proposal.findById(id);
    if (!proposal) {
      return res.status(404).json({ success: false, error: 'Proposal not found' });
    }

    const company = await Company.findOne();

    
    const payload = {
      proposalId: id.toString(),
      message,
      chatHistory: proposal.chatHistory.map(msg => ({
        message: msg.message,
        by: msg.isAdmin ? 'human' : 'ai',
        createdAt: msg.createdAt.toISOString()
      })),
      proposal: proposal.aiContent,
      projectDetails: {
        clientName: proposal.clientName,
        clientEmail: proposal.clientEmail,
        clientIndustry: proposal.clientIndustry,
        projectType: proposal.projectType,
        budget: proposal.budget,
        requirements: proposal.requirements
      },
      companyProfile: {
        name: company.name,
        skills: company.skills,
        teamSize: company.teamSize,
        experience: company.experience,
        description: company.description,
        specialization: company.specialization
      }
    };

    
    const aiResponse = await axios.post(
      `${process.env.AI_API_URL}/chat_proposal_edit`,
      payload,
      { timeout: 60000 }
    );

    const aiReply = aiResponse.data.response || "Understood. I've noted your request.";

    
    proposal.chatHistory.push({
      message,
      isAdmin: true,
      createdAt: new Date()
    });

    proposal.chatHistory.push({
      message: aiReply,
      isAdmin: false,
      createdAt: new Date()
    });

    await proposal.save();

    res.json({
      success: true,
      response: aiReply,
      chatHistory: proposal.chatHistory
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
};


exports.regenerateProposal = async (req, res) => {
  try {
    const { id } = req.params;

    const proposal = await Proposal.findById(id);
    if (!proposal) {
      return res.status(404).json({ success: false, error: 'Proposal not found' });
    }

    const company = await Company.findOne();

  
    const payload = {
      proposalId: id.toString(),
      chatHistory: proposal.chatHistory.map(msg => ({
        message: msg.message,
        by: msg.isAdmin ? 'human' : 'ai',
        createdAt: msg.createdAt.toISOString()
      })),
      proposal: proposal.aiContent,
      projectDetails: {
        clientName: proposal.clientName,
        clientEmail: proposal.clientEmail,
        clientIndustry: proposal.clientIndustry,
        projectType: proposal.projectType,
        budget: proposal.budget,
        requirements: proposal.requirements
      },
      companyProfile: {
        name: company.name,
        skills: company.skills,
        teamSize: company.teamSize,
        experience: company.experience,
        description: company.description,
        specialization: company.specialization
      }
    };

    
    const aiResponse = await axios.post(
      `${process.env.AI_API_URL}/revise_proposal`,
      payload,
      { timeout: 1200000 } 
    );

    const newAiContent = aiResponse.data;

    
    const newVersionNumber = (proposal.versions?.length || 0) + 1;

    proposal.versions.push({
      versionNumber: newVersionNumber,
      aiContent: newAiContent,
      createdAt: new Date()
    });

    
    proposal.aiContent = newAiContent;

    await proposal.save();

    res.json({
      success: true,
      message: `Proposal regenerated successfully as Version ${newVersionNumber}`,
      data: proposal
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
};
exports.generatePdf = async (req, res) => {
  try {
    const { id } = req.params;
    const { version = 'latest' } = req.query;

    const proposal = await Proposal.findById(id).populate('company');
    if (!proposal) {
      return res.status(404).json({ success: false, error: 'Proposal not found' });
    }

    let selectedContent = proposal.aiContent;
    let versionNumber = 'latest';
    let isLatest = true;

    if (version !== 'latest') {
      const selVer = proposal.versions.find(v => v.versionNumber === Number(version));
      if (!selVer) {
        return res.status(404).json({ success: false, error: 'Version not found' });
      }
      selectedContent = selVer.aiContent;
      versionNumber = selVer.versionNumber;
      isLatest = false;
    }

    // Optional: return existing PDF if already generated
    if (isLatest && proposal.pdfUrl) {
      return res.json({
        success: true,
        pdfUrl: proposal.pdfUrl,
        message: 'Using existing PDF (latest)',
        version: 'latest'
      });
    }
    if (!isLatest) {
      const existingVer = proposal.versions.find(v => v.versionNumber === Number(version));
      if (existingVer?.pdfUrl) {
        return res.json({
          success: true,
          pdfUrl: existingVer.pdfUrl,
          message: `Using existing PDF (v${version})`,
          version
        });
      }
    }

    // Prepare content
    const pdfContent = {
      ...proposal.toObject(),
      aiContent: selectedContent,
      versionLabel: isLatest ? 'Latest' : `Version ${versionNumber}`
    };

    const pdfUrl = await generateAndUploadPdf(pdfContent);

    // Save to correct place
    if (isLatest) {
      proposal.pdfUrl = pdfUrl;
    } else {
      const verIndex = proposal.versions.findIndex(v => v.versionNumber === Number(version));
      if (verIndex !== -1) {
        proposal.versions[verIndex].pdfUrl = pdfUrl;
      }
    }

    await proposal.save();

    res.json({
      success: true,
      pdfUrl,
      message: `PDF generated for ${isLatest ? 'latest version' : `version ${version}`}`,
      version: isLatest ? 'latest' : version
    });

  } catch (err) {
    console.error('PDF generation error:', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to generate PDF' });
  }
};

// exports.updateProposal = async (req, res) => {
//   try {
//     const proposal = await Proposal.findById(req.params.id);

//     if (!proposal) {
//       return res.status(404).json({ success: false, error: 'Proposal not found' });
//     }

  
//     if (proposal.status !== 'Draft') {
//       return res.status(403).json({ success: false, error: 'Can only update Draft proposals' });
//     }

    
//     const allowedUpdates = ['title', 'clientName', 'clientEmail', 'clientIndustry', 'projectType', 'budget', 'requirements'];
//     allowedUpdates.forEach(field => {
//       if (req.body[field] !== undefined) {
//         proposal[field] = req.body[field];
//       }
//     });

//     await proposal.save();

//     res.json({
//       success: true,
//       message: 'Proposal updated successfully',
//       data: proposal
//     });
//   } catch (err) {
//     res.status(500).json({ success: false, error: err.message });
//   }
// };

exports.updateProposal = async (req, res) => {
  try {
    const proposal = await Proposal.findById(req.params.id);
    if (!proposal) {
      return res.status(404).json({
        success: false,
        error: 'Proposal not found'
      });
    }

    if (proposal.status !== 'Draft') {
      return res.status(403).json({
        success: false,
        error: 'Can only edit proposals in Draft status'
      });
    }

    let shouldCreateNewVersion = false;

    // 1. Update basic fields 
    const updatableFields = [
      'title',
      'clientName',
      'clientEmail',
      'clientIndustry',
      'projectType',
      'budget',
      'requirements',
      'paymentTerms'
    ];

    updatableFields.forEach(field => {
      if (req.body[field] !== undefined) {
        if (proposal[field] !== req.body[field]) {
          shouldCreateNewVersion = true;
        }
        proposal[field] = req.body[field];
      }
    });

    // 2. Handle aiContent update (merge style - safest & most common)
    if (req.body.aiContent && typeof req.body.aiContent === 'object') {
      shouldCreateNewVersion = true;

      
      proposal.aiContent = {
        ...proposal.aiContent,
        ...req.body.aiContent
      };
    }

    
    // Create new version if anything important changed
    
    if (shouldCreateNewVersion) {
      const newVersionNumber = (proposal.versions?.length || 0) + 1;

      proposal.versions.push({
        versionNumber: newVersionNumber,
        aiContent: { ...proposal.aiContent }, 
        createdAt: new Date(),
        
      });
    }

    await proposal.save();

    res.status(200).json({
      success: true,
      message: shouldCreateNewVersion
        ? `Proposal updated — new version ${proposal.versions.length} created`
        : 'Proposal updated successfully',
      data: proposal
    });

  } catch (error) {
    console.error('updateProposal error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while updating proposal'
    });
  }
};

exports.updateProposalStatus = async (req, res) => {
  try {
    const { status } = req.body;

    if (!['Draft', 'Sent', 'Accepted', 'Rejected'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status' });
    }

    const proposal = await Proposal.findById(req.params.id);
    if (!proposal) {
      return res.status(404).json({ success: false, error: 'Proposal not found' });
    }

    
    if (status === 'Accepted' && proposal.status !== 'Sent') {
      return res.status(400).json({
        success: false,
        error: 'Cannot accept proposal that has not been sent'
      });
    }

    proposal.status = status;
    await proposal.save();

    res.json({
      success: true,
      message: `Status updated to ${status}`,
      data: proposal
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};