const { OpenAI } = require("openai");
const path = require("path");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Extract content from uploaded files using OpenAI Vision API
 * Supports: PDF, DOCX, DOC, TXT, JPG, JPEG, PNG
 */
const extractFileContent = async (file) => {
  try {
    const fileExtension = path.extname(file.originalname).toLowerCase().slice(1);
    const fileType = file.mimetype;
    let extractedData = {
      fileName: file.originalname,
      fileType: fileExtension,
      extractedText: "",
      summary: "",
      keyDetails: [],
    };

    // For images: Use Vision API
    if (["jpg", "jpeg", "png"].includes(fileExtension)) {
      const base64Data = file.buffer.toString("base64");
      const mediaType =
        fileExtension === "png" ? "image/png" : "image/jpeg";

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
      const jsonMatch = content.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        extractedData.extractedText = parsed.extractedText || content;
        extractedData.summary = parsed.summary || "";
        extractedData.keyDetails = parsed.keyDetails || [];
      } else {
        extractedData.extractedText = content;
      }
    }
    // For text files
    else if (["txt"].includes(fileExtension)) {
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
      const jsonMatch = content.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        extractedData.extractedText = parsed.extractedText || textContent;
        extractedData.summary = parsed.summary || "";
        extractedData.keyDetails = parsed.keyDetails || [];
      } else {
        extractedData.extractedText = textContent;
      }
    }
    // For PDF and document files: Convert to base64 and use Vision API
    else if (["pdf", "doc", "docx"].includes(fileExtension)) {
      const base64Data = file.buffer.toString("base64");
      const mediaType =
        fileExtension === "pdf"
          ? "application/pdf"
          : fileExtension === "docx"
            ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            : "application/msword";

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
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        extractedData.extractedText = parsed.extractedText || responseText;
        extractedData.summary = parsed.summary || "";
        extractedData.keyDetails = parsed.keyDetails || [];
      } else {
        extractedData.extractedText = responseText;
      }
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
 * Extract content from multiple files
 */
const extractMultipleFiles = async (files) => {
  const results = [];

  for (const file of files) {
    try {
      const extracted = await extractFileContent(file);
      results.push(extracted);
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
