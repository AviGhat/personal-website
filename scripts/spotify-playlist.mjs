// Snapshot the cockpit playlist into assets/data/playlist.json.
// The Spotify embed API can play a track but can't list a playlist, so the
// cassette deck reads its queue from this file. Re-run after editing the playlist:
//   node scripts/spotify-playlist.mjs
import { writeFile, mkdir } from 'node:fs/promises';

const ID = '1AdTlkC6OvYTXPi8FWJr33';
const res = await fetch(`https://open.spotify.com/embed/playlist/${ID}`, { headers: { 'user-agent': 'Mozilla/5.0' } });
if (!res.ok) throw new Error(`Spotify answered ${res.status}`);
const html = await res.text();
const json = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
if (!json) throw new Error('No playlist data in the embed page');
const entity = JSON.parse(json[1]).props.pageProps.state.data.entity;

const out = {
  name: entity.name,
  owner: entity.subtitle,
  url: `https://open.spotify.com/playlist/${ID}`,
  uri: `spotify:playlist:${ID}`,
  tracks: entity.trackList
    .filter((t) => t.isPlayable)
    .map((t) => ({ uri: t.uri, title: t.title, artist: t.subtitle, ms: t.duration })),
};
await mkdir(new URL('../assets/data/', import.meta.url), { recursive: true });
await writeFile(new URL('../assets/data/playlist.json', import.meta.url), JSON.stringify(out, null, 1) + '\n');
console.log(`${out.name}: ${out.tracks.length} tracks`);
