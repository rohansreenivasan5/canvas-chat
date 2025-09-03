import OpenAI from 'openai';

let openai: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  if (!openai) {
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      console.error('Environment variables available:', Object.keys(process.env).filter(key => key.includes('OPENAI')));
      throw new Error(`Missing OPENAI_API_KEY environment variable. Available env vars: ${Object.keys(process.env).join(', ')}`);
    }
    
    if (apiKey === 'your_openai_api_key_here') {
      throw new Error('Please set a real OpenAI API key in your environment variables');
    }
    
    openai = new OpenAI({
      apiKey: apiKey,
    });
  }
  
  return openai;
}
