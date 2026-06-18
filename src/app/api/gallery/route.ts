import { NextResponse } from 'next/server';

/**
 * GET /api/gallery
 * Returns the user's generated videos. This is mock/demo data — replace with
 * a real data source (database, object storage, etc.) when available.
 */
export async function GET() {
  const gallery = [
    {
      id: 'g1',
      title: 'How Solar Panels Work',
      thumbnail: 'https://picsum.photos/seed/solar/640/360',
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
      aspectRatio: '16:9' as const,
      duration: '0:58',
    },
    {
      id: 'g2',
      title: 'Product Launch Teaser',
      thumbnail: 'https://picsum.photos/seed/launch/360/640',
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
      aspectRatio: '9:16' as const,
      duration: '0:30',
    },
    {
      id: 'g3',
      title: 'Quarterly Recap',
      thumbnail: 'https://picsum.photos/seed/recap/600/600',
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
      aspectRatio: '1:1' as const,
      duration: '1:12',
    },
    {
      id: 'g4',
      title: 'Recipe: 60-Second Pasta',
      thumbnail: 'https://picsum.photos/seed/pasta/360/640',
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
      aspectRatio: '9:16' as const,
      duration: '0:45',
    },
    {
      id: 'g5',
      title: 'Startup Pitch Deck Walkthrough',
      thumbnail: 'https://picsum.photos/seed/pitch/640/360',
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
      aspectRatio: '16:9' as const,
      duration: '1:45',
    },
    {
      id: 'g6',
      title: 'Brand Story Spotlight',
      thumbnail: 'https://picsum.photos/seed/brand/600/600',
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
      aspectRatio: '1:1' as const,
      duration: '0:52',
    },
    {
      id: 'g7',
      title: 'Travel Vlog: Mountain Escape',
      thumbnail: 'https://picsum.photos/seed/travel/640/360',
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4',
      aspectRatio: '16:9' as const,
      duration: '2:03',
    },
    {
      id: 'g8',
      title: 'Quick Tip: Keyboard Shortcuts',
      thumbnail: 'https://picsum.photos/seed/tips/360/640',
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
      aspectRatio: '9:16' as const,
      duration: '0:22',
    },
  ];

  return NextResponse.json(gallery);
}
