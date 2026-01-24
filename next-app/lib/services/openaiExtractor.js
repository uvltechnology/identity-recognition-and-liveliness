// OpenAI extractor wrapper
// TODO: Port logic from original openaiExtractor.js

export async function extractWithOpenAI(text, options = {}){
  if(!text) return { error: 'missing text' }
  // Mocked response for now
  return { model: 'mock-openai', extracted: {}, raw: 'MOCKED OPENAI OUTPUT' }
}

export default { extractWithOpenAI }
