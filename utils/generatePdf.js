const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const A4_WIDTH = 595;
const A4_HEIGHT = 842;
const LM = 54;   // left margin — classic business ~0.75 inch
const RM = 54;
const TM = 72;   // top margin
const BM = 72;   // bottom margin — gives room for page number / signature

async function generateAndUploadPdf(proposal) {
  const pdfDoc = await PDFDocument.create();
  let page = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);
  let width = A4_WIDTH;
  let height = A4_HEIGHT;

  const font     = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const draw = (text, x, y, size = 11, f = font, color = rgb(0,0,0)) => {
    page.drawText(text, { x, y, size, font: f, color });
  };

  const drawMultiline = (text = '', x, yStart, maxW, size = 11, f = font, lineGap = 5) => {
    if (!text?.trim()) return yStart;
    let y = yStart;
    for (const para of text.split(/\n+/)) {
      if (!para.trim()) { y -= size + 8; continue; }
      let line = '';
      for (const word of para.split(' ')) {
        const test = line + word + ' ';
        if (f.widthOfTextAtSize(test, size) > maxW && line.trim()) {
          draw(line.trim(), x, y, size, f);
          y -= size + lineGap;
          line = word + ' ';
        } else {
          line = test;
        }
      }
      if (line.trim()) {
        draw(line.trim(), x, y, size, f);
        y -= size + lineGap;
      }
    }
    return y;
  };

  const newPageIfNeeded = (spaceNeeded = 100) => {
    if (currentY < BM + spaceNeeded) {
      page = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);
      ({ width, height } = page.getSize());
      currentY = height - TM;
      return true;
    }
    return false;
  };

  let currentY = height - TM;

  // ─── Header ───────────────────────────────────────
  draw(proposal.company?.name || 'Company Name', LM, currentY, 20, boldFont);
  currentY -= 36;

  // Logo (optional, compact)
  if (proposal.company?.logoUrl) {
    try {
      const res = await fetch(proposal.company.logoUrl);
      if (res.ok) {
        const buf = await res.arrayBuffer();
        const img = await pdfDoc.embedPng(buf); // ← add .embedJpg if needed
        const maxW = 90;
        const scale = Math.min(maxW / img.width, 50 / img.height);
        page.drawImage(img, {
          x: LM,
          y: currentY - 50,
          width: img.width * scale,
          height: img.height * scale,
        });
        currentY -= 58;
      }
    } catch {}
  }

  draw(proposal.title || `Proposal for ${proposal.clientName || 'Client'}`, LM, currentY, 16, boldFont);
  currentY -= 32;

  // Client block — tighter
  draw(`Client: ${proposal.clientName || '—'}`, LM, currentY, 11, boldFont);
  currentY -= 16;
  if (proposal.clientEmail)   { draw(`Email: ${proposal.clientEmail}`,   LM + 140, currentY, 10); currentY -= 14; }
  if (proposal.clientIndustry){ draw(`Industry: ${proposal.clientIndustry}`, LM + 140, currentY, 10); }

  currentY -= 28; // small gap before first section

  // ─── Sections ─────────────────────────────────────
  const content = proposal.aiContent || {};
  const sections = [
    { title: 'Introduction',               text: content.introduction },
    { title: 'Understanding Your Needs',   text: content.understanding },
    { title: 'Project Scope',              text: content.scopeOfWork },
    { title: 'Suggested Timeline',         text: content.timeline },
    { title: 'Project Feasibility',        text: content.projectFeasibility },
    { title: 'Payment Terms',              text: proposal.paymentTerms },
    { title: 'Closing',                    text: content.closing },
  ];

  for (const sec of sections) {
    if (!sec.text?.trim()) continue;
    newPageIfNeeded(140);
    draw(sec.title, LM, currentY, 13, boldFont);
    currentY -= 20;
    currentY = drawMultiline(sec.text, LM, currentY, width - LM - RM, 11, font, 4.5);
    currentY -= 18; // compact section spacing
  }

  // ─── Price Breakdown ──────────────────────────────
  if (content.priceBreakdown?.length > 0) {
    newPageIfNeeded(180);
    currentY -= 12;
    draw('Price Breakdown', LM, currentY, 13, boldFont);
    currentY -= 24;

    content.priceBreakdown.forEach(item => {
      newPageIfNeeded(70);
      draw(item.category || item.item || 'Service / Phase', LM + 12, currentY, 11);
      draw(
        (item.cost || item.amount || '—').toString(),
        width - RM - 100,
        currentY,
        11,
        boldFont
      );
      currentY -= 18;

      if (item.description?.trim()) {
        currentY = drawMultiline(
          item.description,
          LM + 24,
          currentY - 2,
          width - LM - RM - 120,
          10,
          font,
          4
        );
        currentY -= 10;
      }
    });

    newPageIfNeeded(60);
    draw('Total Project Cost', LM + 12, currentY, 12, boldFont);
    draw(content.pricing || '—', width - RM - 100, currentY, 12, boldFont, rgb(0.05, 0.45, 0.1));
    currentY -= 40;
  }

  // ─── Signature block ──────────────────────────────
  // Try to keep on last page — bottom anchored
  if (currentY > 260) {
    currentY = 260;
  } else {
    page = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);
    currentY = 260;
  }

  draw('Acceptance & Signatures', width / 2 - 95, currentY, 13, boldFont);
  currentY -= 36;

  draw('Client:',         LM,       currentY, 11);
  draw('_______________________________     Date: _______________', LM + 50, currentY, 11);
  currentY -= 32;

  draw('Company:',        LM,       currentY, 11);
  draw('_______________________________     Date: _______________', LM + 60, currentY, 11);

  // Optional: page numbers (uncomment if desired)
  // const pages = pdfDoc.getPageCount();
  // for (let i = 0; i < pages; i++) {
  //   const pg = pdfDoc.getPage(i);
  //   pg.drawText(`Page ${i+1} of ${pages}`, width - RM - 60, BM - 20, 9, font, rgb(0.5,0.5,0.5));
  // }

 const pdfBytes = await pdfDoc.save();
const pdfBuffer = Buffer.from(pdfBytes);

console.log('PDF size before upload:', (pdfBuffer.length / 1024).toFixed(2), 'KB'); // keep this

try {
  const uploadResult = await cloudinary.uploader.upload(
    `data:application/pdf;base64,${pdfBuffer.toString('base64')}`,
    {
      resource_type: 'raw',
      folder: 'proposals',
      public_id: `prop-${proposal._id || 'doc'}-${Date.now()}`,
      // Optional — some newer SDK versions accept this
      // timeout: 120000,
    }
  );
  console.log('Upload success:', uploadResult.secure_url);
  return uploadResult.secure_url;
} catch (err) {
  console.error('Upload failed:', err);
  throw err; // or handle as needed
}
}

module.exports = { generateAndUploadPdf };