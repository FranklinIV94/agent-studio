import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

export async function GET(req: NextRequest, { params }: { params: { name: string } }) {
  const name = params.name;
  const filePath = path.join(process.cwd(), 'public', 'demo_screens', name);
  
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }
  
  const ext = name.split('.').pop()?.toLowerCase();
  const contentTypes: Record<string, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
  };
  
  const buffer = fs.readFileSync(filePath);
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': contentTypes[ext || ''] || 'application/octet-stream',
      'Cache-Control': 'public, max-age=31536000',
    },
  });
}
