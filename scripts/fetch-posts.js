import { ApifyClient } from 'apify-client';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const creatorsPath = path.join(root, 'creators.json');
const postsPath = path.join(root, 'data', 'posts.json');
const token = process.env.APIFY_TOKEN;
const actorId = process.env.APIFY_ACTOR_ID || 'clockworks/tiktok-scraper';
const force = process.argv.includes('--force');
const maxPerCreator = 5;
const retentionMs = 30 * 24 * 60 * 60 * 1000;
const intervalMs = 48 * 60 * 60 * 1000;

function asArray(value) { return Array.isArray(value) ? value : []; }
async function readJson(file, fallback) {
  try { return JSON.parse(await readFile(file, 'utf8')); } catch (error) {
    if (error.code === 'ENOENT') return fallback;
    throw error;
  }
}
function normalizedUsername(value) { return String(value ?? '').trim().replace(/^@/, '').toLowerCase(); }
function validDate(value) { const date = new Date(value); return Number.isNaN(date.getTime()) ? null : date.toISOString(); }
function normalizePost(item, expectedUsername) {
  const username = normalizedUsername(item.authorMeta?.name || item.author?.uniqueId || expectedUsername);
  const id = item.id ?? item.videoId ?? item.aweme_id;
  const publishedAt = validDate(item.createTimeISO || item.createTime ? (item.createTimeISO || Number(item.createTime) * 1000) : null);
  const url = item.webVideoUrl || item.webUrl || item.url || (id && username ? `https://www.tiktok.com/@${username}/video/${id}` : null);
  if (!id || !username || !publishedAt || !url) return null;
  return {
    id: String(id),
    username,
    caption: String(item.text || item.desc || item.description || '').trim(),
    publishedAt,
    url: String(url),
    thumbnailUrl: item.videoMeta?.coverUrl || item.videoMeta?.originalCoverUrl || item.coverUrl || item.thumbnailUrl || null
  };
}
function actorInput(username) {
  return {
    profiles: [username],
    profileScrapeSections: ['videos'],
    profileSorting: 'latest',
    resultsPerPage: maxPerCreator,
    maxProfilesPerQuery: 1,
    excludePinnedPosts: false,
    shouldDownloadVideos: false,
    shouldDownloadCovers: false,
    shouldDownloadAvatars: false,
    shouldDownloadMusicCovers: false,
    shouldDownloadSubtitles: false,
    shouldDownloadSlideshowImages: false,
    scrapeRelatedVideos: false
  };
}
async function safeWrite(data) {
  await mkdir(path.dirname(postsPath), { recursive: true });
  const temporary = `${postsPath}.tmp`;
  await writeFile(temporary, `${JSON.stringify(data, null, 2)}\n`);
  await rename(temporary, postsPath);
}

const creators = [...new Set(asArray(await readJson(creatorsPath, [])).map(normalizedUsername).filter(Boolean))];
const existing = await readJson(postsPath, { updatedAt: null, lastSuccessfulSync: null, posts: [] });
const oldPosts = asArray(existing.posts);

if (!creators.length) throw new Error('creators.json não possui usernames válidos.');
if (!force && existing.lastSuccessfulSync && Date.now() - new Date(existing.lastSuccessfulSync).getTime() < intervalMs) {
  console.log('Coleta ignorada: a última coleta bem-sucedida tem menos de 48 horas.');
  process.exit(0);
}
if (!token) throw new Error('APIFY_TOKEN não foi definido. Configure o segredo no GitHub Actions ou um .env local.');

const client = new ApifyClient({ token });
const fetched = [];
const successfulCreators = new Set();

for (const username of creators) {
  try {
    console.log(`Coletando @${username}…`);
    const run = await client.actor(actorId).call(actorInput(username));
    const { items } = await client.dataset(run.defaultDatasetId).listItems({ clean: true, limit: maxPerCreator });
    for (const item of items) {
      const post = normalizePost(item, username);
      if (post && post.username === username) fetched.push(post);
    }
    successfulCreators.add(username);
  } catch (error) {
    console.warn(`Falha ao coletar @${username}; os posts já existentes serão preservados.`, error.message);
  }
}

if (!successfulCreators.size) {
  throw new Error('Nenhum perfil foi coletado com sucesso; data/posts.json foi preservado.');
}

const cutoff = Date.now() - retentionMs;
const preserved = oldPosts.filter(post => {
  const username = normalizedUsername(post.username);
  return creators.includes(username) && new Date(post.publishedAt).getTime() >= cutoff;
});
const deduplicated = new Map();
for (const post of [...preserved, ...fetched]) {
  if (new Date(post.publishedAt).getTime() >= cutoff) deduplicated.set(String(post.id), post);
}
const posts = [...deduplicated.values()].sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
const now = new Date().toISOString();
await safeWrite({ updatedAt: now, lastSuccessfulSync: now, posts });
console.log(`Concluído: ${fetched.length} novos posts; ${posts.length} posts armazenados.`);
