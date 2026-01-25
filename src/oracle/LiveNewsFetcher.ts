/**
 * TRUTH-NET Live News Fetcher
 * 
 * Fetches real headlines from:
 * 1. RSS Feeds (no API key needed)
 * 2. News APIs (optional, with API key)
 * 
 * Categories: Logistics, Tech-Earnings, Weather, Geopolitics, Niche-Internet
 */

import { EventBus } from '../events/EventBus.js';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// TYPES
// ============================================================================

export interface LiveHeadline {
  id: string;
  title: string;
  summary: string;
  source: string;
  source_url: string;
  category: HeadlineCategory;
  impact_score: number;
  published_at: Date;
  fetched_at: Date;
  tags: string[];
  raw_data?: unknown;
}

export type HeadlineCategory = 
  | 'logistics'
  | 'tech-earnings'
  | 'weather'
  | 'geopolitics'
  | 'niche-internet';

export interface RSSFeedConfig {
  url: string;
  name: string;
  category: HeadlineCategory;
  keywords?: string[];
}

export interface LiveNewsFetcherConfig {
  rssFeeds: RSSFeedConfig[];
  fetchIntervalMs: number;
  maxHeadlinesPerFeed: number;
  newsApiKey?: string; // Optional NewsAPI.org key
  gnewsApiKey?: string; // Optional GNews API key
}

// ============================================================================
// RSS FEED SOURCES (Free, no API key needed)
// ============================================================================

const DEFAULT_RSS_FEEDS: RSSFeedConfig[] = [
  // Logistics & Shipping
  {
    url: 'https://www.freightwaves.com/feed',
    name: 'FreightWaves',
    category: 'logistics',
    keywords: ['shipping', 'freight', 'port', 'container', 'supply chain'],
  },
  {
    url: 'https://gcaptain.com/feed/',
    name: 'gCaptain Maritime',
    category: 'logistics',
    keywords: ['maritime', 'vessel', 'shipping', 'port'],
  },
  {
    url: 'https://www.supplychaindive.com/feeds/news/',
    name: 'Supply Chain Dive',
    category: 'logistics',
    keywords: ['supply chain', 'logistics', 'warehouse'],
  },

  // Tech & Earnings
  {
    url: 'https://techcrunch.com/feed/',
    name: 'TechCrunch',
    category: 'tech-earnings',
    keywords: ['startup', 'funding', 'AI', 'tech'],
  },
  {
    url: 'https://feeds.arstechnica.com/arstechnica/technology-lab',
    name: 'Ars Technica',
    category: 'tech-earnings',
    keywords: ['technology', 'AI', 'cloud'],
  },
  {
    url: 'https://www.theverge.com/rss/index.xml',
    name: 'The Verge',
    category: 'tech-earnings',
    keywords: ['tech', 'AI', 'gadgets'],
  },

  // Weather
  {
    url: 'https://www.nhc.noaa.gov/index-at.xml',
    name: 'NOAA Hurricane Center',
    category: 'weather',
    keywords: ['hurricane', 'storm', 'tropical'],
  },

  // Geopolitics
  {
    url: 'https://feeds.reuters.com/Reuters/worldNews',
    name: 'Reuters World',
    category: 'geopolitics',
    keywords: ['trade', 'tariff', 'sanction', 'conflict'],
  },
  {
    url: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml',
    name: 'NYT World',
    category: 'geopolitics',
    keywords: ['international', 'diplomacy', 'conflict'],
  },

  // Niche Internet
  {
    url: 'https://hnrss.org/frontpage',
    name: 'Hacker News',
    category: 'niche-internet',
    keywords: ['github', 'programming', 'startup', 'viral'],
  },
  {
    url: 'https://www.reddit.com/r/technology/.rss',
    name: 'Reddit Technology',
    category: 'niche-internet',
    keywords: ['reddit', 'viral', 'trending'],
  },
];

// ============================================================================
// RSS PARSER (Simple XML parsing)
// ============================================================================

interface RSSItem {
  title: string;
  description: string;
  link: string;
  pubDate: string;
}

async function parseRSSFeed(url: string): Promise<RSSItem[]> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'TRUTH-NET/1.0 NewsAggregator',
        'Accept': 'application/rss+xml, application/xml, text/xml',
      },
    });

    if (!response.ok) {
      console.error(`[LiveNews] Failed to fetch ${url}: ${response.status}`);
      return [];
    }

    const xml = await response.text();
    const items: RSSItem[] = [];

    // Simple regex-based XML parsing (works for most RSS feeds)
    const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
    const titleRegex = /<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i;
    const descRegex = /<description[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i;
    const linkRegex = /<link[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/i;
    const pubDateRegex = /<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i;

    let match;
    while ((match = itemRegex.exec(xml)) !== null) {
      const itemXml = match[1];
      
      const titleMatch = titleRegex.exec(itemXml);
      const descMatch = descRegex.exec(itemXml);
      const linkMatch = linkRegex.exec(itemXml);
      const pubDateMatch = pubDateRegex.exec(itemXml);

      if (titleMatch) {
        items.push({
          title: cleanHtml(titleMatch[1]),
          description: descMatch ? cleanHtml(descMatch[1]).slice(0, 500) : '',
          link: linkMatch ? linkMatch[1].trim() : '',
          pubDate: pubDateMatch ? pubDateMatch[1].trim() : new Date().toISOString(),
        });
      }
    }

    // Also try Atom format (<entry> instead of <item>)
    const entryRegex = /<entry[^>]*>([\s\S]*?)<\/entry>/gi;
    while ((match = entryRegex.exec(xml)) !== null) {
      const entryXml = match[1];
      
      const titleMatch = titleRegex.exec(entryXml);
      const summaryRegex = /<summary[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/summary>/i;
      const summaryMatch = summaryRegex.exec(entryXml);
      const linkAtomRegex = /<link[^>]*href=["']([^"']+)["'][^>]*>/i;
      const linkMatch = linkAtomRegex.exec(entryXml);
      const updatedRegex = /<updated>([\s\S]*?)<\/updated>/i;
      const updatedMatch = updatedRegex.exec(entryXml);

      if (titleMatch) {
        items.push({
          title: cleanHtml(titleMatch[1]),
          description: summaryMatch ? cleanHtml(summaryMatch[1]).slice(0, 500) : '',
          link: linkMatch ? linkMatch[1].trim() : '',
          pubDate: updatedMatch ? updatedMatch[1].trim() : new Date().toISOString(),
        });
      }
    }

    return items;
  } catch (error) {
    console.error(`[LiveNews] Error fetching ${url}:`, error);
    return [];
  }
}

function cleanHtml(str: string): string {
  return str
    .replace(/<[^>]+>/g, '') // Remove HTML tags
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ============================================================================
// NEWS API INTEGRATION (Optional)
// ============================================================================

interface NewsAPIArticle {
  title: string;
  description: string;
  url: string;
  publishedAt: string;
  source: { name: string };
}

async function fetchFromNewsAPI(
  apiKey: string, 
  category: HeadlineCategory,
  query?: string
): Promise<LiveHeadline[]> {
  try {
    const categoryMap: Record<HeadlineCategory, string> = {
      'logistics': 'shipping OR freight OR "supply chain" OR port',
      'tech-earnings': 'technology OR AI OR "earnings report"',
      'weather': 'hurricane OR storm OR "extreme weather"',
      'geopolitics': 'trade war OR sanctions OR diplomacy',
      'niche-internet': 'viral OR trending OR "social media"',
    };

    const q = query || categoryMap[category];
    const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(q)}&sortBy=publishedAt&pageSize=10&apiKey=${apiKey}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== 'ok' || !data.articles) {
      console.error('[LiveNews] NewsAPI error:', data);
      return [];
    }

    return data.articles.map((article: NewsAPIArticle) => ({
      id: uuidv4(),
      title: article.title,
      summary: article.description || '',
      source: article.source.name,
      source_url: article.url,
      category,
      impact_score: calculateImpactScore(article.title, category),
      published_at: new Date(article.publishedAt),
      fetched_at: new Date(),
      tags: extractTags(article.title, category),
    }));
  } catch (error) {
    console.error('[LiveNews] NewsAPI fetch error:', error);
    return [];
  }
}

// ============================================================================
// GNEWS API INTEGRATION (Optional - 100 free requests/day)
// ============================================================================

async function fetchFromGNews(
  apiKey: string,
  category: HeadlineCategory
): Promise<LiveHeadline[]> {
  try {
    const categoryMap: Record<HeadlineCategory, string> = {
      'logistics': 'shipping OR port OR freight',
      'tech-earnings': 'technology',
      'weather': 'weather OR hurricane',
      'geopolitics': 'world',
      'niche-internet': 'technology',
    };

    const q = categoryMap[category];
    const url = `https://gnews.io/api/v4/search?q=${encodeURIComponent(q)}&lang=en&max=10&apikey=${apiKey}`;

    const response = await fetch(url);
    const data = await response.json();

    if (!data.articles) {
      console.error('[LiveNews] GNews error:', data);
      return [];
    }

    return data.articles.map((article: any) => ({
      id: uuidv4(),
      title: article.title,
      summary: article.description || '',
      source: article.source.name,
      source_url: article.url,
      category,
      impact_score: calculateImpactScore(article.title, category),
      published_at: new Date(article.publishedAt),
      fetched_at: new Date(),
      tags: extractTags(article.title, category),
    }));
  } catch (error) {
    console.error('[LiveNews] GNews fetch error:', error);
    return [];
  }
}

// ============================================================================
// HELPERS
// ============================================================================

function calculateImpactScore(title: string, category: HeadlineCategory): number {
  const lower = title.toLowerCase();
  let score = 0.5;

  // High-impact keywords boost score
  const highImpact = ['breaking', 'urgent', 'major', 'crisis', 'surge', 'crash', 'record', 'unprecedented'];
  const mediumImpact = ['announces', 'launches', 'reports', 'warns', 'delays', 'disruption'];

  for (const word of highImpact) {
    if (lower.includes(word)) score += 0.15;
  }
  for (const word of mediumImpact) {
    if (lower.includes(word)) score += 0.08;
  }

  // Category-specific boosts
  if (category === 'logistics') {
    if (lower.includes('port closure') || lower.includes('strike')) score += 0.2;
    if (lower.includes('canal') || lower.includes('suez') || lower.includes('panama')) score += 0.15;
  }
  if (category === 'weather') {
    if (lower.includes('category') || lower.includes('hurricane')) score += 0.2;
  }
  if (category === 'geopolitics') {
    if (lower.includes('sanction') || lower.includes('tariff') || lower.includes('war')) score += 0.2;
  }

  return Math.min(1, Math.max(0.3, score));
}

function extractTags(title: string, category: HeadlineCategory): string[] {
  const lower = title.toLowerCase();
  const tags: string[] = [category];

  const tagKeywords: Record<string, string[]> = {
    'shipping': ['ship', 'vessel', 'cargo', 'container'],
    'port': ['port', 'harbor', 'dock'],
    'weather': ['storm', 'hurricane', 'flood', 'drought'],
    'tech': ['ai', 'artificial intelligence', 'startup', 'funding'],
    'crypto': ['bitcoin', 'crypto', 'blockchain', 'ethereum'],
    'trade': ['tariff', 'trade', 'export', 'import'],
  };

  for (const [tag, keywords] of Object.entries(tagKeywords)) {
    if (keywords.some(kw => lower.includes(kw))) {
      tags.push(tag);
    }
  }

  return [...new Set(tags)];
}

// ============================================================================
// LIVE NEWS FETCHER SERVICE
// ============================================================================

export class LiveNewsFetcher {
  private config: LiveNewsFetcherConfig;
  private eventBus: EventBus;
  private headlines: LiveHeadline[] = [];
  private fetchInterval: NodeJS.Timeout | null = null;
  private isRunning = false;
  private lastFetch: Date | null = null;

  constructor(eventBus: EventBus, config?: Partial<LiveNewsFetcherConfig>) {
    this.config = {
      rssFeeds: config?.rssFeeds || DEFAULT_RSS_FEEDS,
      fetchIntervalMs: config?.fetchIntervalMs || 300000, // 5 minutes
      maxHeadlinesPerFeed: config?.maxHeadlinesPerFeed || 5,
      newsApiKey: config?.newsApiKey || process.env.NEWS_API_KEY,
      gnewsApiKey: config?.gnewsApiKey || process.env.GNEWS_API_KEY,
    };
    this.eventBus = eventBus;
  }

  /**
   * Start fetching news
   */
  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    console.log('[LiveNews] Starting live news fetcher...');
    console.log(`[LiveNews] Configured ${this.config.rssFeeds.length} RSS feeds`);
    console.log(`[LiveNews] NewsAPI: ${this.config.newsApiKey ? 'configured' : 'not configured'}`);
    console.log(`[LiveNews] GNews: ${this.config.gnewsApiKey ? 'configured' : 'not configured'}`);

    // Initial fetch
    await this.fetchAll();

    // Schedule periodic fetches
    this.fetchInterval = setInterval(() => {
      this.fetchAll();
    }, this.config.fetchIntervalMs);
  }

  /**
   * Stop fetching
   */
  stop(): void {
    this.isRunning = false;
    if (this.fetchInterval) {
      clearInterval(this.fetchInterval);
      this.fetchInterval = null;
    }
    console.log('[LiveNews] Stopped.');
  }

  /**
   * Fetch from all sources
   */
  async fetchAll(): Promise<LiveHeadline[]> {
    console.log('[LiveNews] Fetching from all sources...');
    const newHeadlines: LiveHeadline[] = [];

    // Fetch from RSS feeds
    const rssPromises = this.config.rssFeeds.map(feed => 
      this.fetchFromRSS(feed)
    );
    const rssResults = await Promise.allSettled(rssPromises);
    
    for (const result of rssResults) {
      if (result.status === 'fulfilled') {
        newHeadlines.push(...result.value);
      }
    }

    // Fetch from NewsAPI if configured
    if (this.config.newsApiKey) {
      const categories: HeadlineCategory[] = ['logistics', 'tech-earnings', 'geopolitics'];
      for (const cat of categories) {
        const articles = await fetchFromNewsAPI(this.config.newsApiKey, cat);
        newHeadlines.push(...articles);
      }
    }

    // Fetch from GNews if configured
    if (this.config.gnewsApiKey) {
      const categories: HeadlineCategory[] = ['logistics', 'weather'];
      for (const cat of categories) {
        const articles = await fetchFromGNews(this.config.gnewsApiKey, cat);
        newHeadlines.push(...articles);
      }
    }

    // Deduplicate by title similarity
    const uniqueHeadlines = this.deduplicateHeadlines(newHeadlines);

    // Sort by impact and recency
    uniqueHeadlines.sort((a, b) => {
      const impactDiff = b.impact_score - a.impact_score;
      if (Math.abs(impactDiff) > 0.1) return impactDiff;
      return b.published_at.getTime() - a.published_at.getTime();
    });

    // Add to headlines list
    for (const headline of uniqueHeadlines) {
      if (!this.headlines.some(h => h.title === headline.title)) {
        this.headlines.unshift(headline);
        this.eventBus.publish('headlines.new', headline);
        console.log(`[LiveNews] New: "${headline.title.slice(0, 60)}..." [${headline.category}]`);
      }
    }

    // Keep only last 100
    this.headlines = this.headlines.slice(0, 100);
    this.lastFetch = new Date();

    console.log(`[LiveNews] Fetched ${uniqueHeadlines.length} new headlines. Total: ${this.headlines.length}`);

    return uniqueHeadlines;
  }

  /**
   * Fetch from a single RSS feed
   */
  private async fetchFromRSS(feed: RSSFeedConfig): Promise<LiveHeadline[]> {
    const items = await parseRSSFeed(feed.url);
    
    return items.slice(0, this.config.maxHeadlinesPerFeed).map(item => ({
      id: uuidv4(),
      title: item.title,
      summary: item.description,
      source: feed.name,
      source_url: item.link,
      category: feed.category,
      impact_score: calculateImpactScore(item.title, feed.category),
      published_at: new Date(item.pubDate),
      fetched_at: new Date(),
      tags: extractTags(item.title, feed.category),
    }));
  }

  /**
   * Deduplicate headlines by title similarity
   */
  private deduplicateHeadlines(headlines: LiveHeadline[]): LiveHeadline[] {
    const seen = new Set<string>();
    const unique: LiveHeadline[] = [];

    for (const h of headlines) {
      // Create normalized key for comparison
      const key = h.title.toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .slice(0, 50);
      
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(h);
      }
    }

    return unique;
  }

  /**
   * Get headlines
   */
  getHeadlines(limit: number = 15): LiveHeadline[] {
    return this.headlines.slice(0, limit);
  }

  /**
   * Get headlines by category
   */
  getByCategory(category: HeadlineCategory): LiveHeadline[] {
    return this.headlines.filter(h => h.category === category);
  }

  /**
   * Get high-impact headlines (score > 0.7)
   */
  getHighImpact(): LiveHeadline[] {
    return this.headlines.filter(h => h.impact_score >= 0.7);
  }

  /**
   * Manually trigger fetch
   */
  async refresh(): Promise<LiveHeadline[]> {
    return this.fetchAll();
  }

  /**
   * Get stats
   */
  getStats() {
    return {
      isRunning: this.isRunning,
      totalHeadlines: this.headlines.length,
      lastFetch: this.lastFetch,
      byCategory: {
        logistics: this.headlines.filter(h => h.category === 'logistics').length,
        'tech-earnings': this.headlines.filter(h => h.category === 'tech-earnings').length,
        weather: this.headlines.filter(h => h.category === 'weather').length,
        geopolitics: this.headlines.filter(h => h.category === 'geopolitics').length,
        'niche-internet': this.headlines.filter(h => h.category === 'niche-internet').length,
      },
      feedCount: this.config.rssFeeds.length,
      hasNewsApi: !!this.config.newsApiKey,
      hasGNews: !!this.config.gnewsApiKey,
    };
  }
}
