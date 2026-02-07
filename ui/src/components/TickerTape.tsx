/**
 * TRUTH-NET Ticker Tape
 * Bloomberg-style scrolling price bar pinned to top of viewport
 */

import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { apiClient, Market } from '../api/client';

interface TickerItem {
  ticker: string;
  title: string;
  yesPrice: number;
  change: number;
  volume: number;
}

export default function TickerTape() {
  const [prevPrices, setPrevPrices] = useState<Map<string, number>>(new Map());
  const [flashStates, setFlashStates] = useState<Map<string, 'green' | 'red' | null>>(new Map());
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: marketsData } = useQuery({
    queryKey: ['ticker-markets'],
    queryFn: async () => {
      const response = await apiClient.get<{ markets: Market[]; total: number }>('/markets?limit=50');
      return response;
    },
    staleTime: 30_000,
    refetchInterval: 30_000,
  });

  const markets = marketsData?.markets || [];

  // Build ticker items
  const tickers: TickerItem[] = markets.map(m => {
    const totalVol = (m.volume_yes || 0) + (m.volume_no || 0);
    const yesPrice = totalVol > 0
      ? (m.volume_yes || 0) / totalVol
      : (m.last_price_yes ?? 0.5);
    return {
      ticker: m.ticker,
      title: m.title,
      yesPrice,
      change: 0,
      volume: totalVol,
    };
  }).filter(t => t.volume > 0 || markets.length < 10);

  // Track price changes for flash effects
  useEffect(() => {
    const newFlash = new Map<string, 'green' | 'red' | null>();
    tickers.forEach(t => {
      const prev = prevPrices.get(t.ticker);
      if (prev !== undefined && prev !== t.yesPrice) {
        newFlash.set(t.ticker, t.yesPrice > prev ? 'green' : 'red');
        // Update change
        t.change = t.yesPrice - prev;
      }
    });

    if (newFlash.size > 0) {
      setFlashStates(newFlash);
      setTimeout(() => setFlashStates(new Map()), 600);
    }

    const newPrices = new Map<string, number>();
    tickers.forEach(t => newPrices.set(t.ticker, t.yesPrice));
    setPrevPrices(newPrices);
  }, [marketsData]);

  // If no tickers, show placeholder
  if (tickers.length === 0) {
    return (
      <div className="h-8 bg-[#0a0a0a] border-b border-[#111] flex items-center px-4">
        <span className="text-xs text-gray-600 font-mono">TRUTH-NET LIVE FEED -- Waiting for market data...</span>
      </div>
    );
  }

  // Double the items for seamless scrolling
  const doubledTickers = [...tickers, ...tickers];

  return (
    <div className="h-8 bg-[#050505] border-b border-[#111] overflow-hidden relative">
      {/* Gradient edges */}
      <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-[#050505] to-transparent z-10" />
      <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-[#050505] to-transparent z-10" />

      <div
        ref={scrollRef}
        className="flex items-center h-full animate-marquee whitespace-nowrap"
        style={{
          animationDuration: `${Math.max(30, tickers.length * 4)}s`,
        }}
      >
        {doubledTickers.map((t, i) => {
          const flash = flashStates.get(t.ticker);
          const priceUp = t.change > 0;
          const priceDown = t.change < 0;

          return (
            <div
              key={`${t.ticker}-${i}`}
              className={clsx(
                'flex items-center gap-2 px-4 h-full transition-colors duration-300',
                flash === 'green' && 'bg-emerald-500/10',
                flash === 'red' && 'bg-red-500/10'
              )}
            >
              <span className="text-[11px] font-mono font-bold text-cyan-400">{t.ticker}</span>
              <span className={clsx(
                'text-[11px] font-mono font-bold',
                flash === 'green' || priceUp ? 'text-emerald-400' :
                flash === 'red' || priceDown ? 'text-red-400' :
                'text-gray-300'
              )}>
                {(t.yesPrice * 100).toFixed(1)}¢
              </span>
              {t.change !== 0 && (
                <span className={clsx(
                  'text-[10px] font-mono',
                  t.change > 0 ? 'text-emerald-500' : 'text-red-500'
                )}>
                  {t.change > 0 ? '+' : ''}{(t.change * 100).toFixed(1)}
                </span>
              )}
              <span className="text-[10px] text-gray-700 font-mono">
                ${(t.volume / 1000).toFixed(0)}K
              </span>
              <span className="text-gray-800 mx-1">|</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
