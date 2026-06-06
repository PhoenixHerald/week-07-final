import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const dirPath = path.join(process.cwd(), 'data');
    const filePath = path.join(dirPath, 'data.json');
    
    // Ensure the data directory exists
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (e) {
      // Directory already exists or cannot be created
    }
    let existingData = [];
    try {
      const fileContent = await fs.readFile(filePath, 'utf8');
      existingData = JSON.parse(fileContent);
    } catch (e) {
      // File does not exist yet or is empty
    }
    
    existingData.push(data);
    await fs.writeFile(filePath, JSON.stringify(existingData, null, 2), 'utf8');
    
    return NextResponse.json({ success: true, message: 'Game data saved' }, { status: 200 });
  } catch (error) {
    console.error('Error saving game data:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
