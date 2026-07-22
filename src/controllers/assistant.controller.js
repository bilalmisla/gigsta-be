const { OpenAI } = require("openai");
const path = require("node:path");
const Inquiry = require("../models/inquiry.model.js");
const Gig = require("../models/gig.model.js");
const { extractMultipleFiles } = require("../utils/fileExtractor.js");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // Ensure this is set in your .env
});

const INITIAL_PROJECT_DETAILS = "Chat session started - awaiting full project requirements.";
const BOOKING_LINK = 'https://calendar.google.com/calendar/appointments/schedules/AcZssZ33yLOCv7DUeruVilUgjx9ybRByluRS8gt05MZbosEqFT6KmQ5AEd62y02rx7Bjs_ViZw86wNaa';
const DEFAULT_FRONTEND_URL = 'https://gigsta.ai';
const NO_MATCH_PATTERNS = [
  'no exact match',
  "don't have exact",
  'no gigs',
  "couldn't find",
  "don't currently have",
];
const REQUIREMENT_KEYWORDS = [
  'requirement', 'requirements', 'project', 'brief', 'spec', 'specification',
  'logo', 'website', 'design', 'budget', 'deadline', 'due', 'contact', 'email',
  'order', 'deliver', 'scope', 'timeline', 'need', 'want', 'create', 'build', 'launch',
];

/**
 * Lightweight email check without nested regex quantifiers (Sonar S5852).
 */
const isValidEmail = (email) => {
  if (typeof email !== 'string' || email.includes(' ')) return false;
  const at = email.indexOf('@');
  if (at <= 0 || at !== email.lastIndexOf('@')) return false;
  const domain = email.slice(at + 1);
  const dot = domain.lastIndexOf('.');
  return dot > 0 && dot < domain.length - 1;
};

const stripHtml = (html) => {
  if (!html) return 'N/A';
  let result = '';
  let insideTag = false;
  for (const char of html) {
    if (char === '<') {
      insideTag = true;
    } else if (char === '>') {
      insideTag = false;
    } else if (!insideTag) {
      result += char;
    }
  }
  return result || 'N/A';
};

/**
 * Parse the first JSON object embedded in free-form AI text without regex backtracking.
 */
const parseJsonFromText = (text) => {
  if (!text || typeof text !== "string") return null;
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
};

/**
 * Downloads any file type from a Cloudinary URL and returns it as a Buffer.
 * Works with PNG, JPG, PDF, DOCX, MP3, etc.
 * 
 * @param {string} cloudinaryUrl - The full Cloudinary asset URL
 * @returns {Promise<Buffer>} The file data as a Node.js Buffer
 */
const getFileBufferFromCloudinary = async (cloudinaryUrl) => {
  try {
    const response = await fetch(cloudinaryUrl);
    
    if (!response.ok) {
      throw new Error(`Cloudinary fetch failed: ${response.status} ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
    
  } catch (error) {
    console.error("Error reading file from Cloudinary URL:", error.message);
    throw error;
  }
};

const extensionFromContentType = (contentType) => {
  if (!contentType) return null;
  const lower = contentType.toLowerCase();
  if (lower.includes("jpeg") || lower.includes("jpg")) return "jpg";
  if (lower.includes("png")) return "png";
  if (lower.includes("pdf")) return "pdf";
  if (lower.includes("wordprocessingml.document")) return "docx";
  if (lower.includes("msword")) return "doc";
  if (lower.includes("plain")) return "txt";
  return null;
};

const fetchRemoteFile = async (url, fallbackName) => {
  const buffer = await getFileBufferFromCloudinary(url);
  const contentType = "application/octet-stream";
  const urlPath = new URL(url).pathname;
  let originalname = path.basename(urlPath) || fallbackName || "remote-file";
  if (!path.extname(originalname)) {
    const extension = extensionFromContentType(contentType);
    if (extension) {
      originalname = `${originalname}.${extension}`;
    }
  }

  return {
    buffer,
    originalname,
    mimetype: contentType,
    sourceUrl: url,
  };
};

const buildRemoteFilesFromUrls = async (fileUrls, fileNames = []) => {
  return Promise.all(
    fileUrls.map((url, index) => fetchRemoteFile(url, fileNames[index]))
  );
};

const detectRecommendationLoop = (msgs) => {
  const assistantMessages = msgs.filter((m) => m.role === 'assistant');
  if (assistantMessages.length < 3) return false;

  const lastThreeAssistant = assistantMessages.slice(-3);
  let matchCount = 0;
  for (const msg of lastThreeAssistant) {
    const content = msg.content?.toLowerCase() || '';
    if (NO_MATCH_PATTERNS.some((pattern) => content.includes(pattern))) {
      matchCount++;
    }
  }

  return matchCount >= 2;
};

const buildSystemPrompt = () => ({
  role: "system",
  content: `
        // SYSTEM INSTRUCTIONS FOR AI GIGSTA ASSISTANT

## Assistant Identity and Purpose
You are "Gigsta," an AI assistant, a technology company that provides services including administration support, design, web development, video editing, automation, and other digital solutions.
Your role is to communicate professionally and accurately with potential clients, understand their business needs, and collect all relevant project details required for successful execution.
You are skilled in client intake, business communication, and project discovery. You interact with business owners in a professional, friendly, and approachable manner while maintaining clear and organized communication.
Your primary goal is to gather complete project requirements by asking thoughtful follow-up questions. Continue the conversation until you are at least 85% confident that enough information has been collected for the team to properly scope and execute the project.

Always:
-Ask one clear question at a time when possible.
-Keep responses concise and easy to understand.
-Clarify unclear requirements before making assumptions.
-Summarize important project details when needed.
-Maintain a helpful, confident, and consultative tone.
-Focus on understanding the client’s goals, timeline, budget, technical requirements, and expected outcomes.

Unrelated Questions:
If a user's question is not related to Gigsta, our services, or their project requirements, do not answer the question.
-Instead, respond: "Thank you for your question. I'm here to assist with Gigsta services. Your question appears to be outside the scope of our services. If you have a project or service request, I'd be happy to help."

Contact Information:
If users ask for support, contact information, or how to reach Gigsta.ai, provide:
Contact: https://gigsta.ai/contact-us

## Response Guidelines
- Keep replies short, clear, and to the point.
- Ask only what’s needed, based on service requested.
- Keep tone friendly and professional.

## Interaction Guidelines and Mandatory Information Collection

### Get the email
-Could you please share your email address so we can keep you updated? If client declines email upfront, continue conversation and request it again before wrapping up.

## Service-Specific Information Collection
For all inquiries, refer to the *Information Collection Guides* and ask relevant questions for the specified service category.

### Design Services
#### Categories:
- Logo Design
- Web Design
- Print Design (flyers, brochures, business cards)

### Logo
1. Do you have an existing logo or brand mark?
2. What is the name of your business for the logo? (Include a tagline if applicable.)
3. Describe your preferred logo style.
4. Could you describe your brand’s personality and target audience?
5. Any specific colors or fonts you'd like to include
6. Do you have your website? Please share URL
7. Do you need a brandkit? (collection of vital elements that define and represent a company's brand identity)
8. Any additional information
9. What is your budget?

### Flyer/Poster/Banner/Graphics Design Details
1. What is the purpose of the flyer/poster? Examples: Event promotion, product advertisement.
2. Preferred size and format? Examples: A4, letter size, digital only.
3. Any specific imagery or content to include, such as dates, times, location, eligibility?
4. Any additional information
5. What is your budget?

### Web Design Details
1. How many pages do you need? (e.g., Home, About, Services, Contact, etc.)
2. Do you need e-commerce functionality? (Yes/No)
3. Do you have a website logo? (Yes/No)
4. Provide any design inspirations or website references: (Please provide links or descriptions of websites you like)
5. Do you have a deadline for this project? (Yes/No – Specify date)
6. Do you have a budget range for this project? (Please specify)
7. Any additional information

### Business Card Design Details
1. How many business cards do you need? (e.g., quantity or for different team members)
2. What information should be included? (Name, contact details, company logo, etc.)
3. Do you have a budget range? (Please specify)
4. Any additional information

### Web Development
#### Categories:
- One Page Website Design and Development
- E-commerce Website (Shopify)
- Website Maintenance and Updates
- SEO and Performance Optimization

#### General Questions:
1. What is the purpose of your website? For instance, is it an e-commerce platform, portfolio, blog, or a company site?
2. Do you have a preferred platform or CMS (e.g., ReactJS, WordPress, Shopify, Squarespace, or a custom-built solution)?
3. Could you share any design references or examples that inspire the look and feel you envision for your website?
4. Do you have a website logo? (Yes/No)
5. What content will be included on the website? Please list the main pages or sections (e.g., Home, About, Services, Blog, Contact) and any specific content or media.
6. Do you have any specific functional requirements? (e.g., contact forms, e-commerce functionality, booking systems, or membership areas)
7. Do you have hosting details ready, or will you need assistance setting up hosting services?
8. What is your project deadline?
9. What is your budget range for this project?
10. How many pages do you need? (e.g., Home, About, Services, Contact)
11. Do you need e-commerce functionality? (Yes/No)
12. Do you require additional SEO or web performance optimizations?
13. Are there compliance needs such as web accessibility (ADA/WCAG compliance)?

### Administrative/Admin Support
#### Categories:
- Data Entry
- Scheduling and Calendar Management

#### Questions:
1. What administrative tasks do you need assistance with?
2. Is this a one-time project or ongoing support?
3. Are there specific tools or software you prefer using?
4. What is your timeline and budget?

### Video Editing
#### Categories:
- Post-Production Editing
- Motion Graphics and Animation

#### Questions:
1. What is the purpose of your video? (Marketing, social media, instructional, etc.)
2. Do you have raw footage, or will you need additional production support?
3. Are there specific edits or enhancements you’re looking for? (e.g., color grading, VFX)
4. What formats or platforms will the video be optimized for?
5. What is your timeline and budget?

## Submission and Confirmation Process
- After collecting all necessary information, summarize the details for the client to confirm:
  - Example: "Here’s a summary of your request:
    - Email: [Client Email]
    - Project Name: [Extract from project details]
    - Project Type: [Categorize based on project details; if it doesn't match predefined types, label as "Other"]
    - Project Details: [List of gathered details specific to the request]
  Could you please confirm if everything is correct? We will process to match the best gig with your requirements"
- Wait for the client’s confirmation before proceeding. If they indicate any corrections, update the details and re-confirm.

## Finalization and Next Steps:
- Once the client confirms all details, Let's match the best gig. 

"**

## Handling "Other" Inquiries
- If the request does not match existing services, classify as "Other".  
- Gather relevant details and respond:  
  - "We appreciate your request! Your project falls under a custom category. Our team will review your details and get back to you soon"

## Final Notes
- If a user’s question is **not related to our services or about/what is gigsta**, respond:  
  **"Thanks for your request! Currently, we don’t offer services in that area. Here are the services we do provide:"**   
  (Then list the currently available service categories clearly.) and if you'd like to chat with a team member directly, feel free to book a session here: ${BOOKING_LINK}*  
  ## IMPORTANT: Loop Prevention and Direct CTA
- If you detect the user has been through recommendation loops (asked multiple times without finding exact matches), STOP asking follow-up questions
- Instead, provide a DIRECT booking CTA: "We couldn't find an exact match for your specific requirements. However, our team specializes in custom solutions. Book a consultation with us and we'll connect you with the right person to build exactly what you need."
 `
});

const formatFileSummaries = (items) =>
  items
    .map(
      (item) =>
        `File: ${item.fileName}\nSummary: ${item.summary || 'No summary available'}\nKey Details: ${Array.isArray(item.keyDetails) && item.keyDetails.length ? item.keyDetails.join('; ') : 'None'}\n`
    )
    .join('\n');

const createFallbackInquiry = async () => {
  const fallbackInquiry = new Inquiry({
    name: null,
    email: null,
    projectDetails: INITIAL_PROJECT_DETAILS,
  });
  await fallbackInquiry.save();
  return fallbackInquiry._id;
};

const persistInquiryFiles = async (inquiryId, allUploadedFiles, extractedContents) => {
  try {
    const inquiry = await Inquiry.findById(inquiryId);
    if (!inquiry) return;
    const fileReferences = allUploadedFiles.map((file) => file.sourceUrl || file.originalname);
    inquiry.files = [...new Set([...(inquiry.files || []), ...fileReferences])];
    inquiry.fileUploadChoice = 'yes';
    inquiry.extractedContent = [...(inquiry.extractedContent || []), ...extractedContents];
    await inquiry.save();
  } catch (saveErr) {
    console.error('Failed to persist inquiry files/extraction:', saveErr);
  }
};

const classifyHasRequirements = async (extractedContents) => {
  const buildExtractionPrompt = (extracted) => {
    const text = ((extracted.extractedText || '') + '\n' + (extracted.summary || '') + '\n' + (Array.isArray(extracted.keyDetails) ? extracted.keyDetails.join('; ') : '')).trim();
    return `File: ${extracted.fileName}\nExtractedText: ${text}`;
  };

  const fileAnalysisPrompt = `You are a Gigsta intake assistant. Determine whether the extracted content below contains actual project requirements or service-related information for a digital services request. Answer strictly with JSON: {"hasRequirements": true|false, "reason": "short reason"}. Do not describe the image or file content. Only decide if requirements are present in the extracted text.`;

  const classificationResponse = await openai.chat.completions.create({
    model: 'gpt-4.1',
    messages: [
      { role: 'system', content: fileAnalysisPrompt },
      { role: 'user', content: extractedContents.map(buildExtractionPrompt).join('\n\n---\n\n') },
    ],
    temperature: 0,
    max_tokens: 250,
  });

  let hasRequirements = false;
  try {
    const classificationText = classificationResponse.choices[0].message.content || '';
    const parsed = parseJsonFromText(classificationText);
    if (parsed) {
      hasRequirements = Boolean(parsed.hasRequirements);
    }
  } catch (parseErr) {
    console.error('Failed to parse requirement classification:', parseErr);
  }

  if (hasRequirements) return true;

  const fallbackText = extractedContents
    .map((extracted) => `${extracted.extractedText || ''} ${extracted.summary || ''} ${(Array.isArray(extracted.keyDetails) ? extracted.keyDetails.join(' ') : '')}`)
    .join(' ')
    .toLowerCase();
  const fallbackMatch = REQUIREMENT_KEYWORDS.some((kw) => fallbackText.includes(kw));
  if (fallbackMatch && fallbackText.length > 80) {
    console.log('Fallback requirement detection passed for uploaded file content.');
    return true;
  }
  return false;
};

const processUploadedFiles = async ({
  allUploadedFiles,
  formattedMessages,
  inquiryId,
}) => {
  let nextInquiryId = inquiryId;
  let extractedContents = [];

  try {
    extractedContents = await extractMultipleFiles(allUploadedFiles);
    const hasRequirements = await classifyHasRequirements(extractedContents);

    if (!nextInquiryId) {
      nextInquiryId = await createFallbackInquiry();
    }

    await persistInquiryFiles(nextInquiryId, allUploadedFiles, extractedContents);

    const allUploadsAreImages = allUploadedFiles.every(
      (f) => /(\.jpe?g|\.png)$/i.test(f.originalname) || f.mimetype?.startsWith('image/')
    );

    if (!hasRequirements && allUploadsAreImages) {
      return {
        inquiryId: nextInquiryId,
        extractedContents,
        earlyResponse: {
          role: 'assistant',
          content: "Sorry, I can’t process this image because it is not related to the project or our services.",
          isConfirmed: false,
          inquiryId: nextInquiryId,
        },
      };
    }

    formattedMessages.push({
      role: 'user',
      content: `Here is the extracted content from the attached files:\n\n${formatFileSummaries(extractedContents)}`,
    });
  } catch (fileErr) {
    console.error('Error extracting uploaded files:', fileErr);
  }

  return { inquiryId: nextInquiryId, extractedContents, earlyResponse: null };
};

const upsertLeadInquiry = async ({ extractedName, extractedEmail, gigId }) => {
  let leadInquiry = await Inquiry.findOne({ email: extractedEmail, webhookSent: false }).sort({ createdAt: -1 });
  if (!leadInquiry) {
    leadInquiry = new Inquiry({
      name: extractedName,
      email: extractedEmail,
      projectDetails: INITIAL_PROJECT_DETAILS,
      budget: null,
      gigId: gigId || undefined,
    });
  } else {
    leadInquiry.name = extractedName;
    leadInquiry.email = extractedEmail;
    if (!leadInquiry.gigId && gigId) {
      leadInquiry.gigId = gigId;
    }
  }
  await leadInquiry.save();
  return leadInquiry._id;
};

const saveConfirmedInquiry = async ({ latestInquiry, confirmedName, confirmedEmail, extracted, gigId }) => {
  let inquiry = latestInquiry;
  if (!inquiry) {
    inquiry = new Inquiry({
      name: confirmedName,
      email: confirmedEmail,
      projectDetails: extracted.projectDetails || INITIAL_PROJECT_DETAILS,
      budget: extracted.budget || null,
      gigId: gigId || undefined,
    });
  } else {
    inquiry.name = confirmedName;
    inquiry.email = confirmedEmail;
    inquiry.projectDetails = extracted.projectDetails || inquiry.projectDetails || INITIAL_PROJECT_DETAILS;
    inquiry.budget = extracted.budget || inquiry.budget || null;
    if (!inquiry.gigId && gigId) {
      inquiry.gigId = gigId;
    }
  }
  await inquiry.save();
  return inquiry._id;
};

const buildGigSummaries = (gigs) => {
  const frontendUrl = process.env.FRONTEND_URL || DEFAULT_FRONTEND_URL;
  return gigs
    .map((gig, i) => {
      const description = stripHtml(gig.description);
      return `${i + 1}. Title: ${gig.title}\n- Gig Id: ${gig._id}\n- Category: ${gig.category}\n- Description: ${description}\n- Short Summary: ${gig.shortDesc || 'N/A'}\n- Delivery Time: ${gig.deliveryTime} days\n- Revisions: ${gig.revisionNumber}\n- Features: ${gig.features?.join(', ') || 'N/A'}\n- Price: $${gig.price}\n- Checkout URL: ${frontendUrl}/pay/${gig._id}`;
    })
    .join('\n\n');
};

const pushMatchInstructions = ({
  formattedMessages,
  gigs,
  extracted,
  safeQuery,
  inRecommendationLoop,
  confidenceThreshold,
}) => {
  if (gigs.length > 0 && extracted.confidenceScore >= confidenceThreshold) {
    formattedMessages.push({
      role: "system",
      content: `SYSTEM INSTRUCTION: The user has confirmed. Here are the matching gigs from our database. Present these gigs to the user enthusiastically and provide their checkout URLs so they can make a purchase:\n\n${buildGigSummaries(gigs)}`,
    });
  } else if (inRecommendationLoop || extracted.confidenceScore < confidenceThreshold) {
    formattedMessages.push({
      role: "system",
      content: `SYSTEM INSTRUCTION: The user confirmed their request, but we don't have exact matches for their specific requirements. Instead of asking more questions, provide a DIRECT next step. Say something like: "We couldn't find an exact match for your specific requirements. However, our team specializes in custom solutions. Book a consultation with us and we'll connect you with the right person to build exactly what you need." Then provide the booking link: ${BOOKING_LINK}`,
    });
  } else {
    formattedMessages.push({
      role: "system",
      content: `SYSTEM INSTRUCTION: The user has confirmed, but no gigs were found for the query "${safeQuery}". Let the user know we don't have exact matches but provide a direct booking CTA instead of asking more questions. Booking link: ${BOOKING_LINK}`,
    });
  }
};

const extractConversationIntent = async (formattedMessages) => {
  const extraction = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      ...formattedMessages,
      {
        role: "system",
        content: `Analyze the conversation. Check if the user's latest message is explicitly confirming their project details to proceed (e.g., saying "yes", "proceed", "confirmed", "go ahead", or any relevant English word/phrase with the same meaning).
              Return a JSON object strictly with these keys: 
              - "isConfirmed": boolean (true ONLY if the user is making a final confirmation to proceed)
              - "name": string (if available)
              - "email": string (if available)
              - "budget": string (if available, e.g., "$500-$1000", "budget not specified")
              - "projectDetails": string (summary of their project)
              - "searchQuery": string (1-2 word keyword like 'logo', 'web design', 'video editing' based on their needs)
              - "confidenceScore": number (0-100, how confident you are that we can find a match)`,
      },
    ],
    temperature: 0,
  });

  return JSON.parse(extraction.choices[0].message.content);
};

const resolveLatestInquiry = async (inquiryId, extractedEmail) => {
  const knownInquiry = inquiryId ? await Inquiry.findById(inquiryId) : null;
  if (knownInquiry) return knownInquiry;
  if (!isValidEmail(extractedEmail)) return null;
  return Inquiry.findOne({ email: extractedEmail, webhookSent: false }).sort({ createdAt: -1 });
};

const getMissingIdentityFields = (confirmedName, confirmedEmail) => {
  const missingFields = [];
  if (!confirmedName) missingFields.push("name");
  if (!isValidEmail(confirmedEmail)) missingFields.push("email");
  return missingFields;
};

const processConfirmedRequest = async ({
  formattedMessages,
  latestInquiry,
  confirmedName,
  confirmedEmail,
  extracted,
  gigId,
  inRecommendationLoop,
  confidenceThreshold,
}) => {
  const nextInquiryId = await saveConfirmedInquiry({
    latestInquiry,
    confirmedName,
    confirmedEmail,
    extracted,
    gigId,
  });

  const safeQuery = extracted.searchQuery;
  const gigs = await Gig.find({
    $or: [
      { title: { $regex: safeQuery, $options: 'i' } },
      { category: { $regex: safeQuery, $options: 'i' } },
    ],
  }).populate('userID', 'username image').limit(3);

  pushMatchInstructions({
    formattedMessages,
    gigs,
    extracted,
    safeQuery,
    inRecommendationLoop,
    confidenceThreshold,
  });

  return {
    isConfirmed: true,
    extractedData: {
      ...extracted,
      name: confirmedName,
      email: confirmedEmail,
    },
    matchedGigs: gigs,
    inquiryId: nextInquiryId,
  };
};

const handleConfirmationFlow = async ({
  formattedMessages,
  inquiryId,
  gigId,
  inRecommendationLoop,
}) => {
  const result = {
    isConfirmed: false,
    extractedData: {},
    matchedGigs: [],
    inquiryId,
  };

  try {
    const extracted = await extractConversationIntent(formattedMessages);
    const confidenceThreshold = 50;

    const extractedName = (extracted.name || "").trim();
    const extractedEmail = (extracted.email || "").trim().toLowerCase();
    if (extractedName && isValidEmail(extractedEmail)) {
      result.inquiryId = await upsertLeadInquiry({ extractedName, extractedEmail, gigId });
    }

    if (!(extracted.isConfirmed && extracted.searchQuery)) {
      if (inRecommendationLoop) {
        formattedMessages.push({
          role: "system",
          content: `SYSTEM INSTRUCTION: We've been going in circles trying to find a match. Break the cycle NOW. Respond with: "It sounds like your project needs a custom solution tailored to your specific requirements. Rather than continuing to search through our standard offerings, I'd like to connect you directly with our team. Book a consultation here and we'll ensure you get exactly what you need: ${BOOKING_LINK}"`,
        });
      }
      return result;
    }

    const latestInquiry = await resolveLatestInquiry(result.inquiryId, extractedEmail);
    const confirmedName = (extracted.name || latestInquiry?.name || "").trim();
    const confirmedEmail = (extracted.email || latestInquiry?.email || "").trim().toLowerCase();
    const missingFields = getMissingIdentityFields(confirmedName, confirmedEmail);

    if (missingFields.length > 0) {
      const missingText = missingFields.length === 2 ? "name and email" : missingFields[0];
      formattedMessages.push({
        role: "system",
        content: `SYSTEM INSTRUCTION: The user is trying to confirm, but ${missingText} is missing. Ask for the missing ${missingText} in one short friendly message and do not confirm or finalize yet.`,
      });
      return result;
    }

    const confirmed = await processConfirmedRequest({
      formattedMessages,
      latestInquiry,
      confirmedName,
      confirmedEmail,
      extracted,
      gigId,
      inRecommendationLoop,
      confidenceThreshold,
    });

    return { ...result, ...confirmed };
  } catch (err) {
    console.error("Manual intent extraction error:", err);
    return result;
  }
};

const savePostChatExtractions = async (inquiryId, allUploadedFiles) => {
  let nextInquiryId = inquiryId;
  let extractedContent = [];

  if (allUploadedFiles.length === 0) {
    return { inquiryId: nextInquiryId, extractedContent };
  }

  try {
    if (!nextInquiryId) {
      nextInquiryId = await createFallbackInquiry();
    }

    extractedContent = await extractMultipleFiles(allUploadedFiles);

    const inquiry = await Inquiry.findById(nextInquiryId);
    if (inquiry) {
      inquiry.extractedContent = [...(inquiry.extractedContent || []), ...extractedContent];
      const fileReferences = allUploadedFiles.map((file) => file.sourceUrl || file.originalname);
      inquiry.files = [...new Set([...(inquiry.files || []), ...fileReferences])];
      inquiry.fileUploadChoice = 'yes';
      await inquiry.save();
      console.log(`✅ Extracted content from ${allUploadedFiles.length} file(s) and saved to inquiry ${nextInquiryId}`);
    }
  } catch (extractError) {
    console.error("Error extracting file content in chat handler:", extractError);
    extractedContent = [{
      fileName: "extraction-error.txt",
      fileType: "error",
      extractedText: "",
      summary: `Failed to extract files: ${extractError.message}`,
      keyDetails: [],
      error: true,
    }];
  }

  return { inquiryId: nextInquiryId, extractedContent };
};

const buildChatResponseObject = async ({
  responseMessage,
  isConfirmed,
  extractedData,
  matchedGigs,
  extractedContent,
  inquiryId,
}) => {
  const responseObject = {
    role: responseMessage.role,
    content: responseMessage.content,
    isConfirmed,
  };

  if (isConfirmed && Object.keys(extractedData).length > 0) {
    responseObject.extractedData = {
      name: extractedData.name,
      email: extractedData.email,
      budget: extractedData.budget,
      projectDetails: extractedData.projectDetails,
      searchQuery: extractedData.searchQuery,
    };
  }

  if (matchedGigs.length > 0) {
    responseObject.gigs = matchedGigs.map((gig) => ({
      _id: gig._id,
      title: gig.title,
      category: gig.category,
      description: gig.description,
      shortDesc: gig.shortDesc,
      price: gig.price,
      deliveryTime: gig.deliveryTime,
      revisionNumber: gig.revisionNumber,
      features: gig.features,
      userID: gig.userID,
    }));
  }

  if (extractedContent.length > 0) {
    responseObject.extractedContent = extractedContent;
  }

  if (inquiryId) {
    responseObject.inquiryId = inquiryId;
  }

  if (!responseObject.inquiryId) {
    try {
      const fallbackInquiry = new Inquiry({
        name: "Anonymous",
        email: "anonymous@placeholder.local",
        projectDetails: INITIAL_PROJECT_DETAILS,
      });
      await fallbackInquiry.save();
      responseObject.inquiryId = fallbackInquiry._id;
      console.log(`✅ Created fallback inquiry ${fallbackInquiry._id} for file uploads`);
    } catch (e) {
      console.error('Failed to create fallback inquiry for file uploads:', e);
    }
  }

  return responseObject;
};

const parseIncomingMessages = (messages) => {
  if (typeof messages !== 'string') return { messages, error: null };
  try {
    return { messages: JSON.parse(messages), error: null };
  } catch {
    return { messages: null, error: "Invalid messages format" };
  }
};

const loadRemoteFiles = async (fileUrls, fileNames) => {
  if (!Array.isArray(fileUrls) || fileUrls.length === 0) return [];
  try {
    return await buildRemoteFilesFromUrls(fileUrls, Array.isArray(fileNames) ? fileNames : []);
  } catch (remoteFetchError) {
    console.error('Error fetching remote files from Cloudinary:', remoteFetchError);
    return [];
  }
};

const appendPreviousExtraction = async (inquiryId, formattedMessages) => {
  if (!inquiryId) return;
  try {
    const existingInquiry = await Inquiry.findById(inquiryId);
    if (existingInquiry?.extractedContent?.length > 0) {
      formattedMessages.push({
        role: 'user',
        content: `Previously extracted content for this inquiry:\n\n${formatFileSummaries(existingInquiry.extractedContent)}`,
      });
    }
  } catch (e) {
    console.error('Failed to load existing inquiry extracted content:', e);
  }
};

const stripGigPayload = (messages) =>
  messages.map((m) => {
    const rest = { ...m };
    delete rest.gigs;
    return rest;
  });

const chatHandler = async (req, res) => {
  try {
    const { messages: rawMessages, gigId, fileUrls, fileNames, inquiryId: incomingInquiryId } = req.body;

    const parsed = parseIncomingMessages(rawMessages);
    if (parsed.error) {
      return res.status(400).send(parsed.error);
    }
    if (!Array.isArray(parsed.messages)) {
      return res.status(400).send("Messages array is required");
    }

    let inquiryId = incomingInquiryId || null;
    const remoteFiles = await loadRemoteFiles(fileUrls, fileNames);
    const formattedMessages = [buildSystemPrompt(), ...stripGigPayload(parsed.messages)];
    const allUploadedFiles = [...(req.files || []), ...remoteFiles];

    await appendPreviousExtraction(inquiryId, formattedMessages);

    if (allUploadedFiles.length > 0) {
      formattedMessages.push({
        role: 'system',
        content: 'The user has attached one or more files. Use extracted file content to identify project requirements and relate the results to Gigsta services. If a file does not contain any project requirements or requirements-related content, do not describe the file and instead respond with: "Sorry, I can’t process this image because it is not related to the project or our services."',
      });
    }

    const inRecommendationLoop = detectRecommendationLoop(formattedMessages);

    if (allUploadedFiles.length > 0) {
      const fileResult = await processUploadedFiles({
        allUploadedFiles,
        formattedMessages,
        inquiryId,
      });
      inquiryId = fileResult.inquiryId;
      if (fileResult.earlyResponse) {
        return res.status(200).json(fileResult.earlyResponse);
      }
    }

    const confirmation = await handleConfirmationFlow({
      formattedMessages,
      inquiryId,
      gigId,
      inRecommendationLoop,
    });

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: formattedMessages,
    });

    const saved = await savePostChatExtractions(confirmation.inquiryId, allUploadedFiles);

    const responseObject = await buildChatResponseObject({
      responseMessage: response.choices[0].message,
      isConfirmed: confirmation.isConfirmed,
      extractedData: confirmation.extractedData,
      matchedGigs: confirmation.matchedGigs,
      extractedContent: saved.extractedContent,
      inquiryId: saved.inquiryId,
    });

    return res.status(200).json(responseObject);
  } catch (error) {
    console.error("OpenAI Chat Completions Error:", error);
    res.status(500).send("Something went wrong with the AI assistant.");
  }
};

const uploadInquiryFiles = async (req, res) => {
  try {
    const { inquiryId, fileUrls } = req.body;

    if (!inquiryId) {
      return res.status(400).send("inquiryId is required");
    }

    if (!Array.isArray(fileUrls)) {
      return res.status(400).send("fileUrls array is required");
    }

    const inquiry = await Inquiry.findById(inquiryId);

    if (!inquiry) {
      return res.status(404).send("Inquiry not found for this visitor ID.");
    }

    inquiry.files = [...(inquiry.files || []), ...fileUrls];
    await inquiry.save();

    return res.status(200).json({
      success: true,
      message: "Files uploaded and linked to inquiry successfully.",
      inquiry,
    });
  } catch (error) {
    console.error("Error in uploadInquiryFiles:", error);
    res.status(500).send("Something went wrong saving inquiry files.");
  }
};

const sendFinalizeWebhook = async (inquiry) => {
  const webhookUrl = process.env.WEBHOOK_URL;
  if (!webhookUrl) {
    console.warn("⚠️ WEBHOOK_URL not configured in environment");
    return;
  }

  try {
    const webhookPayload = {
      name: inquiry.name,
      email: inquiry.email,
      budget: inquiry.budget,
      projectDetails: inquiry.projectDetails,
      fileUploadChoice: inquiry.fileUploadChoice,
      fileUrls: inquiry.files || [],
      inquiryId: inquiry._id,
      createdAt: inquiry.createdAt,
      timestamp: new Date().toISOString(),
    };

    console.log("📤 Sending webhook to:", webhookUrl);
    console.log("📋 Webhook payload:", JSON.stringify(webhookPayload, null, 2));

    const webhookResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(webhookPayload),
    });

    if (webhookResponse.ok) {
      console.log("✅ Webhook sent successfully");
    } else {
      console.warn(`⚠️ Webhook returned status ${webhookResponse.status}`);
    }
  } catch (webhookError) {
    console.error("❌ Webhook call failed:", webhookError);
  }
};

const finalizeInquiry = async (req, res) => {
  try {
    const { inquiryId, userChoice } = req.body;

    if (!inquiryId) {
      return res.status(400).json({ success: false, message: "inquiryId is required" });
    }

    if (!userChoice || !['yes', 'no'].includes(userChoice.toLowerCase())) {
      return res.status(400).json({ success: false, message: "userChoice must be 'yes' or 'no'" });
    }

    const inquiry = await Inquiry.findById(inquiryId);

    if (!inquiry) {
      return res.status(404).json({ success: false, message: "Inquiry not found for this visitor ID." });
    }

    inquiry.fileUploadChoice = userChoice.toLowerCase();
    inquiry.webhookSent = true;
    await inquiry.save();

    await sendFinalizeWebhook(inquiry);

    return res.status(200).json({
      success: true,
      message: "Inquiry finalized successfully",
      inquiry,
      messages: [
        {
          role: "assistant",
          content: "Thank you for your response! 🎉",
        },
        {
          role: "assistant",
          content: `Please proceed to checkout, or if you'd like to discuss your project with a team member first, feel free to [book a session here](${BOOKING_LINK}).`,
        },
        {
          role: "assistant",
          content: "This conversation has ended. To begin a new request, please start a new chat.",
        },
      ],
    });
  } catch (error) {
    console.error("Error in finalizeInquiry:", error);
    res.status(500).json({ success: false, message: "Something went wrong finalizing the inquiry." });
  }
};

module.exports = {
  chatHandler,
  uploadInquiryFiles,
  finalizeInquiry,
};
