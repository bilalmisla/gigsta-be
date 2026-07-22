const { OpenAI } = require("openai");
const path = require("node:path");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png"]);
const TEXT_EXTENSIONS = new Set(["txt"]);
const DOCUMENT_EXTENSIONS = new Set(["pdf", "doc", "docx"]);

const MEDIA_TYPES = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  doc: "application/msword",
};

const createEmptyExtractedData = (fileName, fileExtension) => ({
  fileName,
  fileType: fileExtension,
  extractedText: "",
  summary: "",
  keyDetails: [],
});

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

const applyParsedExtraction = (extractedData, parsed, fallbackText) => {
  if (parsed) {
    extractedData.extractedText = parsed.extractedText || fallbackText;
    extractedData.summary = parsed.summary || "";
    extractedData.keyDetails = parsed.keyDetails || [];
  } else {
    extractedData.extractedText = fallbackText;
  }
};

const extractFromImage = async (file, fileExtension, extractedData) => {
  const base64Data = file.buffer.toString("base64");
  const mediaType = MEDIA_TYPES[fileExtension] || "image/jpeg";

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: {
              url: `data:${mediaType};base64,${base64Data}`,
            },
          },
          {
            type: "text",
            text: `Please analyze this image and extract all relevant information. 
                Provide:
                1. A complete text description of what you see
                2. A brief summary (2-3 sentences)
                3. Key details or information extracted (as bullet points)
                
                Format your response as JSON with keys: extractedText, summary, keyDetails (array)`,
          },
        ],
      },
    ],
    max_tokens: 1024,
  });

  const content = response.choices[0].message.content;
  applyParsedExtraction(extractedData, parseJsonFromText(content), content);
};

const extractFromTextFile = async (file, extractedData) => {
  const textContent = file.buffer.toString("utf-8");

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "user",
        content: `Please analyze the following text and extract key information.
            
Text content:
${textContent}

Provide:
1. The full extracted text (as-is)
2. A brief summary (2-3 sentences)
3. Key details or important points (as bullet points)

Format your response as JSON with keys: extractedText, summary, keyDetails (array)`,
      },
    ],
    max_tokens: 2048,
  });

  const content = response.choices[0].message.content;
  applyParsedExtraction(
    extractedData,
    parseJsonFromText(content),
    textContent
  );
};

const extractFromDocument = async (file, fileExtension, extractedData) => {
  const base64Data = file.buffer.toString("base64");
  const mediaType = MEDIA_TYPES[fileExtension] || "application/msword";

  const response = await openai.responses.create({
    model: "gpt-4.1-mini",
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_file",
            filename: file.originalname,
            file_data: `data:${mediaType};base64,${base64Data}`,
          },
          {
            type: "input_text",
            text: "Extract details from this file and return strict JSON with keys: extractedText (string), summary (string), keyDetails (array of strings).",
          },
        ],
      },
    ],
  });

  const responseText = response.output_text || "";
  applyParsedExtraction(
    extractedData,
    parseJsonFromText(responseText),
    responseText
  );
};

/**
 * Extract content from uploaded files using OpenAI Vision API
 * Supports: PDF, DOCX, DOC, TXT, JPG, JPEG, PNG
 */
const extractFileContent = async (file) => {
  try {
    const fileExtension = path.extname(file.originalname).toLowerCase().slice(1);
    const extractedData = createEmptyExtractedData(
      file.originalname,
      fileExtension
    );

    if (IMAGE_EXTENSIONS.has(fileExtension)) {
      await extractFromImage(file, fileExtension, extractedData);
    } else if (TEXT_EXTENSIONS.has(fileExtension)) {
      await extractFromTextFile(file, extractedData);
    } else if (DOCUMENT_EXTENSIONS.has(fileExtension)) {
      await extractFromDocument(file, fileExtension, extractedData);
    }

    return extractedData;
  } catch (error) {
    console.error(`Error extracting content from ${file.originalname}:`, error);
    throw new Error(
      `Failed to extract content from ${file.originalname}: ${error.message}`
    );
  }
};

/**
 * Run a logo-specific extractor on text to pull structured logo design details
 */
const extractLogoDetails = async (text) => {
  try {
    const prompt = `You are an assistant that extracts logo design requirements from arbitrary text.
Return strict JSON with keys: businessName (string or empty), tagline (string or empty), preferredColors (array of color names or hex codes), style (one-line description like "modern", "minimal", "vintage"), targetAudience (string), additionalNotes (array of short strings). If no data is found for a key, return empty string or empty array accordingly.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: prompt },
        { role: "user", content: `Text to analyze:\n\n${text}` },
      ],
      temperature: 0,
    });

    const content = response.choices[0].message.content || "";
    return parseJsonFromText(content);
  } catch (err) {
    console.error("Logo extraction error:", err);
    return null;
  }
};

// Enhance extracted data with logo-specific details when possible
const enhanceWithLogoDetails = async (extractedData) => {
  try {
    const textForAnalysis =
      extractedData.extractedText || extractedData.summary || "";
    if (!textForAnalysis || textForAnalysis.length < 20) return extractedData;
    const logoInfo = await extractLogoDetails(textForAnalysis);
    if (logoInfo) {
      extractedData.logoDetails = logoInfo;
    }
  } catch (e) {
    console.error("Error enhancing with logo details:", e);
  }
  return extractedData;
};

/**
 * Extract content from multiple files
 */
const extractMultipleFiles = async (files) => {
  const results = [];

  for (const file of files) {
    try {
      const extracted = await extractFileContent(file);
      const enriched = await enhanceWithLogoDetails(extracted);
      results.push(enriched);
    } catch (error) {
      console.error(`Error processing file ${file.originalname}:`, error);
      results.push({
        fileName: file.originalname,
        fileType: path.extname(file.originalname).toLowerCase().slice(1),
        extractedText: "",
        summary: `Error extracting content: ${error.message}`,
        keyDetails: [],
        error: true,
      });
    }
  }

  return results;
};

module.exports = {
  extractFileContent,
  extractMultipleFiles,
};
