// Document processor module for handling resume and cover letter processing
export class DocumentProcessor {
  static async processFile(file) {
    if (!file) {
      throw new Error('No file provided');
    }

    try {
      if (file.name.toLowerCase().endsWith('.docx')) {
        if (typeof window.mammoth === 'undefined') {
          throw new Error('Document processing library not properly loaded');
        }

        const arrayBuffer = await file.arrayBuffer();
        const result = await window.mammoth.extractRawText({ arrayBuffer });
        
        if (!result || !result.value) {
          throw new Error('Could not extract text from DOCX file');
        }
        return result.value;
      } else if (file.name.toLowerCase().endsWith('.txt')) {
        return await file.text();
      } else {
        throw new Error('Unsupported file type. Please upload a .docx or .txt file');
      }
    } catch (error) {
      console.error('File processing error:', error);
      throw error;
    }
  }

  static async uploadResume(file, databaseManager) {
    const text = await this.processFile(file);
    if (!text || text.trim().length === 0) {
      throw new Error('No text could be extracted from the file');
    }

    await databaseManager.updateField('resumeText', text);
    return text;
  }

  static async uploadCoverLetter(file, databaseManager) {
    const text = await this.processFile(file);
    if (!text || text.trim().length === 0) {
      throw new Error('No text could be extracted from the file');
    }

    await databaseManager.updateField('coverLetterText', text);
    return text;
  }

  static async clearResume(databaseManager) {
    await databaseManager.updateField('resumeText', '');
  }

  static async clearCoverLetter(databaseManager) {
    await databaseManager.updateField('coverLetterText', '');
  }

  // Function to process QA document text and convert to JSON format
  static async processQADocument(text, apiKey) {
    try {
      // Preprocess the document
      const cleanedText = this.preprocessDocument(text);
      
      // Estimate tokens (rough estimation - 4 chars per token)
      const estimatedTokens = Math.ceil(cleanedText.length / 4);
      const CHUNK_SIZE = 6000;
      const OVERLAP_SIZE = 200;
      
      console.log(`Original text length: ${text.length}, Cleaned text length: ${cleanedText.length}`);
      console.log(`Estimated tokens: ${estimatedTokens}`);
      
      if (estimatedTokens <= CHUNK_SIZE) {
        // Process entire document at once
        return await this.processQAChunk(cleanedText, apiKey);
      } else {
        // Process document in chunks
        return await this.processLargeQADocument(cleanedText, CHUNK_SIZE, OVERLAP_SIZE, apiKey);
      }
    } catch (error) {
      console.error('Error processing QA document:', error);
      throw error;
    }
  }

  static preprocessDocument(text) {
    // Remove excessive empty lines (more than 2)
    text = text.replace(/\n{3,}/g, '\n\n');
    
    // Remove special characters that might cause issues
    text = text.replace(/[\u2018\u2019]/g, "'"); // Smart quotes
    text = text.replace(/[\u201C\u201D]/g, '"'); // Smart double quotes
    text = text.replace(/[\u2013\u2014]/g, '-'); // Em and en dashes
    text = text.replace(/[^\x20-\x7E\n]/g, ''); // Remove other non-standard characters
    
    // Normalize line endings
    text = text.replace(/\r\n/g, '\n');
    
    return text;
  }

  static findChunkBoundary(text, position, direction = 'forward') {
    // Look for double newlines within a reasonable range
    const SEARCH_RANGE = 500; // Look up to 500 chars forward/backward
    
    if (direction === 'forward') {
      const searchText = text.substr(position, SEARCH_RANGE);
      const match = searchText.match(/\n\n/);
      return match ? position + match.index + 2 : position;
    } else {
      const searchText = text.substr(Math.max(0, position - SEARCH_RANGE), Math.min(position, SEARCH_RANGE));
      const matches = Array.from(searchText.matchAll(/\n\n/g));
      return matches.length ? Math.max(0, position - SEARCH_RANGE) + matches[matches.length - 1].index + 2 : position;
    }
  }

  static async processLargeQADocument(text, chunkSize, overlapSize, apiKey) {
    const allQAPairs = [];
    let currentPosition = 0;
    let remainingText = '';

    while (currentPosition < text.length) {
      console.log(`Processing chunk starting at position ${currentPosition}`);
      
      // Find a safe splitting point near the chunk size
      let endPosition = this.findChunkBoundary(text, currentPosition + chunkSize);
      let chunk = text.slice(currentPosition, endPosition);
      
      // Add remaining text from previous chunk if it exists
      if (remainingText) {
        chunk = remainingText + '\n\n' + chunk;
        console.log('Added remaining text to current chunk');
      }

      // Process current chunk
      try {
        const result = await this.processQAChunk(chunk, apiKey);
        
        // Store QA pairs
        if (result.qa_pairs && result.qa_pairs.length > 0) {
          allQAPairs.push(...result.qa_pairs);
          console.log(`Found ${result.qa_pairs.length} QA pairs in current chunk`);
        }

        // Update remaining text for next iteration
        remainingText = result.remaining_text || '';
        
        // If we got no QA pairs and have remaining text, adjust chunk size
        if (result.qa_pairs.length === 0 && remainingText) {
          console.log('No QA pairs found in chunk, adjusting chunk size');
          chunkSize = Math.max(3000, Math.floor(chunkSize * 0.8)); // Reduce chunk size but not below 3000
        }

      } catch (error) {
        console.error('Error processing chunk, trying smaller chunk:', error);
        // If chunk processing failed, try with a smaller chunk
        endPosition = this.findChunkBoundary(text, currentPosition + Math.floor(chunkSize / 2));
        chunk = text.slice(currentPosition, endPosition);
        
        // Try processing smaller chunk
        const result = await this.processQAChunk(chunk, apiKey);
        if (result.qa_pairs && result.qa_pairs.length > 0) {
          allQAPairs.push(...result.qa_pairs);
          console.log(`Found ${result.qa_pairs.length} QA pairs in smaller chunk`);
        }
        remainingText = result.remaining_text || '';
      }
      
      // Move position for next chunk, accounting for overlap
      currentPosition = Math.max(endPosition - overlapSize, currentPosition + 1);
      
      // Break if we've processed everything and there's no remaining text
      if (currentPosition >= text.length && !remainingText) {
        break;
      }
    }

    // Process any final remaining text if it exists
    if (remainingText) {
      console.log('Processing final remaining text');
      try {
        const finalResult = await this.processQAChunk(remainingText, apiKey);
        if (finalResult.qa_pairs && finalResult.qa_pairs.length > 0) {
          allQAPairs.push(...finalResult.qa_pairs);
        }
      } catch (error) {
        console.error('Error processing final remaining text:', error);
      }
    }

    return {
      qa_pairs: allQAPairs,
      remaining_text: ''
    };
  }

  static async processQAChunk(text, apiKey) {
    try {
      console.log('Sending chunk to API, length:', text.length);
      
      const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `Analyze this text and extract all question-answer pairs. For each question, make it slightly more generic/searchable while preserving its core meaning, but keep the answers exactly as they are. Do not modify or simplify the answers at all.

For example:
"Q: What specific programming languages did you use at Amazon from 2020-2022?"
Could become:
"Q: What programming languages did you use at Amazon?"

Respond ONLY with a JSON array of objects in this exact format:
{
  "qa_pairs": [
    {
      "question": "simplified but still specific question",
      "answer": "exact original answer, unmodified"
    }
  ],
  "remaining_text": "any text at the end that might contain incomplete Q&A pairs"
}

Text to process:
${text}`
            }]
          }]
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'API request failed');
      }

      const data = await response.json();
      const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!responseText) {
        throw new Error('Empty response from API');
      }

      // Log the raw response for debugging
      console.log('Raw API response text:', responseText);

      // Extract JSON from response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error('No JSON object found in response text. Full response:', responseText);
        throw new Error('No valid JSON found in response');
      }
      
      let jsonString = jsonMatch[0];
      console.log('Initial JSON string:', jsonString);

      // Clean up and fix common JSON issues
      const cleanupJSON = (str) => {
        // If the JSON appears to be cut off (no closing brackets), attempt to fix it
        let openBraces = (str.match(/\{/g) || []).length;
        let closeBraces = (str.match(/\}/g) || []).length;
        let openBrackets = (str.match(/\[/g) || []).length;
        let closeBrackets = (str.match(/\]/g) || []).length;

        console.log('JSON structure analysis:', {
          openBraces, closeBraces, openBrackets, closeBrackets
        });

        let result = str;

        // If we have a qa_pairs array that's not properly closed
        if (result.includes('"qa_pairs": [') && openBrackets > closeBrackets) {
          // Check if the last item needs a comma
          if (result.match(/\}\s*\}/)) {
            // Replace the last '}' with '}]}'
            result = result.replace(/\}\s*\}$/, '}]}');
          } else {
            // Just add the closing bracket
            result = result + ']}';
          }
        }

        // Add any missing closing braces
        while (openBraces > closeBraces) {
          result = result + '}';
          closeBraces++;
        }

        return result;
      };

      jsonString = cleanupJSON(jsonString);
      console.log('Cleaned JSON string:', jsonString);

      // Try parsing with more detailed error handling
      let result;
      try {
        result = JSON.parse(jsonString);
      } catch (parseError) {
        // Log the specific position where parsing failed
        console.error('JSON parse error details:', {
          error: parseError.message,
          position: parseError.message.match(/position (\d+)/)?.[1],
          // Get context around the error position if available
          context: parseError.message.match(/position (\d+)/) ? 
            jsonString.slice(Math.max(0, parseInt(parseError.message.match(/position (\d+)/)[1]) - 50), 
                           Math.min(jsonString.length, parseInt(parseError.message.match(/position (\d+)/)[1]) + 50))
            : 'No position information'
        });
        
        // Create a debug file with the problematic JSON
        const debugData = {
          timestamp: new Date().toISOString(),
          rawResponse: responseText,
          extractedJson: jsonString,
          error: parseError.message
        };
        
        // Log to console in a way that can be copied
        console.log('DEBUG DATA (copy this):');
        console.log(JSON.stringify(debugData, null, 2));
        
        throw parseError;
      }
      
      // Validate the response format
      if (!result.qa_pairs || !Array.isArray(result.qa_pairs)) {
        console.error('Invalid response structure:', result);
        throw new Error('Invalid response format: missing qa_pairs array');
      }

      // Validate each QA pair
      result.qa_pairs.forEach((pair, index) => {
        if (!pair.question || !pair.answer) {
          console.error('Invalid QA pair at index', index, ':', pair);
          throw new Error(`Invalid QA pair at index ${index}: missing question or answer`);
        }
      });

      return result;
    } catch (error) {
      console.error('Error processing QA chunk:', error);
      throw error;
    }
  }
} 