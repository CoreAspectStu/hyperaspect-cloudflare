import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { input, type } = await req.json();
  let questions: string[] = [];

  switch (type) {
    case 'describe':
      questions = [
        'What tone do you want? (Professional, Casual, etc.)',
        'Who is your target audience?',
        'What is the main call to action?',
        'Do you have any specific visual references or brand guidelines?',
      ];
      break;
    case 'url':
      questions = [
        'What is the primary goal of the content on this URL?',
        'Are there specific sections or elements on the page you want to focus on or exclude?',
        'Who is the target audience for the content on this URL?',
      ];
      break;
    case 'video':
      questions = [
        'What is the main message or purpose of this video?',
        'Are there any particular scenes or moments you want to highlight or change?',
        'What emotional response should this video evoke?',
      ];
      break;
    case 'document':
      questions = [
        'What is the key information or message in this document?',
        'Is there a specific section of the document you want to summarize or transform?',
        'What is the desired output format or style based on this document?',
      ];
      break;
    case 'voice':
      questions = [
        'What is the overall sentiment or emotion conveyed in the voice input?',
        'Are there specific keywords or phrases in the voice input that are particularly important?',
        'What kind of output are you expecting based on this voice input?',
      ];
      break;
    default:
      questions = ['Please provide more details about your request.'];
  }

  return NextResponse.json({ questions });
}