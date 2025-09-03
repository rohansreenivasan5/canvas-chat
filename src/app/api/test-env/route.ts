import { NextResponse } from 'next/server';

export async function GET() {
  const hasApiKey = !!process.env.OPENAI_API_KEY;
  const apiKeyLength = process.env.OPENAI_API_KEY?.length || 0;
  
  return NextResponse.json({
    hasApiKey,
    apiKeyLength,
    nodeEnv: process.env.NODE_ENV,
    timestamp: new Date().toISOString()
  });
}
