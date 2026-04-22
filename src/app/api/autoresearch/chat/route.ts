import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';

// Global lock to prevent concurrent AI inferences
// which cause massive GPU memory thrashing and freezes.
let isGenerating = false;

export async function POST(req: Request): Promise<Response> {
  if (isGenerating) {
    return NextResponse.json(
      { error: 'AI is already processing a request. Please wait until it finishes.' },
      { status: 429 }
    );
  }

  try {
    const { prompt } = await req.json();

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    isGenerating = true;

    const autoResearchDir = path.resolve('C:/Users/SNTRK/Desktop/AutoResearch');

    const response = await new Promise<Response>((resolve) => {
      let outputData = '';
      let errorData = '';

      const pythonProcess = spawn('uv', ['run', 'chat.py', prompt], {
        cwd: autoResearchDir,
      });

      pythonProcess.stdout.on('data', (data) => {
        outputData += data.toString();
      });

      pythonProcess.stderr.on('data', (data) => {
        errorData += data.toString();
      });

      pythonProcess.on('close', (code) => {
        isGenerating = false;

        if (code !== 0) {
          console.error(`AI Model Inference failed: ${errorData}`);
          resolve(NextResponse.json({ error: errorData || 'Inference failed' }, { status: 500 }));
          return;
        }

        const responseMatch = outputData.match(/--- MEXCBRAIN RESPONSE ---\n([\s\S]*?)\n--------------------------/);
        const cleanResponse = responseMatch
          ? responseMatch[1].trim()
          : outputData.trim();

        resolve(NextResponse.json({ response: cleanResponse }));
      });
    });

    return response;

  } catch (error) {
    isGenerating = false;
    console.error('Error querying AI Brain:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
