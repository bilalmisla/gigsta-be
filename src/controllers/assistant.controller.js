const { OpenAI } = require("openai");
const Inquiry = require("../models/inquiry.model.js");
const Gig = require("../models/gig.model.js");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // Ensure this is set in your .env
});

const chatHandler = async (req, res, next) => {
  try {
    const { messages, gigId, visitorId } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).send("Messages array is required");
    }

    if (!visitorId) {
      return res.status(400).send("visitorId is required");
    }

    // Detect if we're in a recommendation loop
    const detectRecommendationLoop = (msgs) => {
      const assistantMessages = msgs.filter(m => m.role === 'assistant');
      if (assistantMessages.length < 3) return false;

      // Check if the last 3 assistant messages contain "no exact matches" or similar patterns
      const lastThreeAssistant = assistantMessages.slice(-3);
      const noMatchPatterns = [
        'no exact match',
        'don\'t have exact',
        'no gigs',
        'couldn\'t find',
        'don\'t currently have'
      ];

      let matchCount = 0;
      for (const msg of lastThreeAssistant) {
        for (const pattern of noMatchPatterns) {
          if (msg.content.toLowerCase().includes(pattern)) {
            matchCount++;
            break;
          }
        }
      }

      // If 2 or more of the last 3 messages mention no matches, we're likely in a loop
      return matchCount >= 2;
    };

    const bookingLink = 'https://calendar.google.com/calendar/appointments/schedules/AcZssZ33yLOCv7DUeruVilUgjx9ybRByluRS8gt05MZbosEqFT6KmQ5AEd62y02rx7Bjs_ViZw86wNaa';

    const systemPrompt = {
      role: "system",
      content: `
        // SYSTEM INSTRUCTIONS FOR AI GIGSTA ASSISTANT

## Assistant Identity and Purpose
You are "Gigsta," an AI assistant for Made in South LA, a technology company that provides services including administration support, design, web development, video editing, automation, and other digital solutions.
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
  (Then list the currently available service categories clearly.)
  *And if you'd like to chat with a team member directly, feel free to book a session here: [Appointment Link]*  
  https://calendar.google.com/calendar/u/0/appointments/schedules/AcZssZ12CzBM-zin4DChxDKy23reiJ1ETHTI2W2rwC9Ga6KO_HUp7P8JiLi9BGdQvtOe1SKvb2kuPNDg
## IMPORTANT: Loop Prevention and Direct CTA
- If you detect the user has been through recommendation loops (asked multiple times without finding exact matches), STOP asking follow-up questions
- Instead, provide a DIRECT booking CTA: "We couldn't find an exact match for your specific requirements. However, our team specializes in custom solutions. Book a consultation with us and we'll connect you with the right person to build exactly what you need."
- Provide the booking link: https://calendar.google.com/calendar/appointments/schedules/AcZssZ33yLOCv7DUeruVilUgjx9ybRByluRS8gt05MZbosEqFT6KmQ5AEd62y02rx7Bjs_ViZw86wNaa
- NEVER continue asking clarifying questions if the user has already been through this loop      `
    };

    // Filter out UI specific gig objects from frontend messages
    const formattedMessages = [
      systemPrompt,
      ...messages.map(m => {
        const { gigs, ...rest } = m;
        return rest;
      })
    ];

    // Check for recommendation loop BEFORE making API calls
    const inRecommendationLoop = detectRecommendationLoop(formattedMessages);

    // let attachedGigs = [];

    // Step 1: Use AI common sense to verify if the user's last message is a confirmation
    let isConfirmed = false;
    try {
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
              - "projectDetails": string (summary of their project)
              - "searchQuery": string (1-2 word keyword like 'logo', 'web design', 'video editing' based on their needs)
              - "confidenceScore": number (0-100, how confident you are that we can find a match)`
          }
        ],
        temperature: 0
      });

      const extracted = JSON.parse(extraction.choices[0].message.content);
      const confidenceThreshold = 50; // Only proceed if confidence > 50%

      if (extracted.isConfirmed) {
        isConfirmed = true;
      }

      // Ensure the AI actually agrees that this is a confirmation
      if (extracted.isConfirmed && extracted.searchQuery) {
        // 1. Save Inquiry
        if (extracted.name && extracted.email) {
          const newInquiry = new Inquiry({
            name: extracted.name,
            email: extracted.email,
            projectDetails: extracted.projectDetails,
            visitorId: visitorId,
            gigId: gigId || undefined,
          });
          await newInquiry.save();
        }

        // 2. Search Gigs (only if confidence is high enough)
        const safeQuery = extracted.searchQuery;
        const gigs = await Gig.find({
          $or: [
            { title: { $regex: safeQuery, $options: 'i' } },
            { category: { $regex: safeQuery, $options: 'i' } }
          ]
        }).populate('userID', 'username image').limit(3);

        // attachedGigs = gigs;

        if (gigs.length > 0 && extracted.confidenceScore >= confidenceThreshold) {
          const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
          const summaries = gigs.map((gig, i) => {
            return `${i + 1}. Title: ${gig.title}\n- Gig Id: ${gig._id}\n- Category: ${gig.category}\n- Description: ${gig.description ? gig.description.replace(/(<([^>]+)>)/gi, '') : 'N/A'}\n- Short Summary: ${gig.shortDesc || 'N/A'}\n- Delivery Time: ${gig.deliveryTime} days\n- Revisions: ${gig.revisionNumber}\n- Features: ${gig.features?.join(', ') || 'N/A'}\n- Price: $${gig.price}\n- Checkout URL: ${frontendUrl}/pay/${gig._id}`;
          }).join('\n\n');

          formattedMessages.push({
            role: "system",
            content: `SYSTEM INSTRUCTION: The user has confirmed. Here are the matching gigs from our database. Present these gigs to the user enthusiastically and provide their checkout URLs so they can make a purchase:\n\n${summaries}`
          });
        } else if (inRecommendationLoop || extracted.confidenceScore < confidenceThreshold) {
          // If we're in a loop or low confidence, offer direct booking instead
          formattedMessages.push({
            role: "system",
            content: `SYSTEM INSTRUCTION: The user confirmed their request, but we don't have exact matches for their specific requirements. Instead of asking more questions, provide a DIRECT next step. Say something like: "We couldn't find an exact match for your specific requirements. However, our team specializes in custom solutions. Book a consultation with us and we'll connect you with the right person to build exactly what you need." Then provide the booking link: ${bookingLink}`
          });
        } else {
          formattedMessages.push({
            role: "system",
            content: `SYSTEM INSTRUCTION: The user has confirmed, but no gigs were found for the query "${safeQuery}". Let the user know we don't have exact matches but provide a direct booking CTA instead of asking more questions. Booking link: ${bookingLink}`
          });
        }
      } else if (inRecommendationLoop) {
        // If we're already in a loop and user hasn't confirmed, break the cycle with direct CTA
        formattedMessages.push({
          role: "system",
          content: `SYSTEM INSTRUCTION: We've been going in circles trying to find a match. Break the cycle NOW. Respond with: "It sounds like your project needs a custom solution tailored to your specific requirements. Rather than continuing to search through our standard offerings, I'd like to connect you directly with our team. Book a consultation here and we'll ensure you get exactly what you need: ${bookingLink}"`
        });
      }
    } catch (err) {
      console.error("Manual intent extraction error:", err);
    }
    // }

    // Step 3: Main Chat Completion (No tools)
    let response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: formattedMessages,
    });

    let responseMessage = response.choices[0].message;

    // if (attachedGigs.length > 0) {
    //   responseMessage.gigs = attachedGigs;
    // }

    return res.status(200).json({
      role: responseMessage.role,
      content: responseMessage.content,
      isConfirmed: isConfirmed
    });
  } catch (error) {
    console.error("OpenAI Chat Completions Error:", error);
    res.status(500).send("Something went wrong with the AI assistant.");
  }
};

const uploadInquiryFiles = async (req, res, next) => {
  try {
    const { visitorId, fileUrls } = req.body;

    if (!visitorId) {
      return res.status(400).send("visitorId is required");
    }

    if (!fileUrls || !Array.isArray(fileUrls)) {
      return res.status(400).send("fileUrls array is required");
    }

    // Find the most recent inquiry for this visitorId
    const inquiry = await Inquiry.findOne({ visitorId }).sort({ createdAt: -1 });

    if (!inquiry) {
      return res.status(404).send("Inquiry not found for this visitor ID.");
    }

    // Update files field
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

module.exports = {
  chatHandler,
  uploadInquiryFiles,
};
