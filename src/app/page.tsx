"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase, type City } from '@/lib/supabase/client';

export default function Home() {
  const [cities, setCities] = useState<City[]>([]);
  const [selected, setSelected] = useState<string>('');

  useEffect(() => {
    const stored = localStorage.getItem('moves_city');
    if (stored) setSelected(stored);
    supabase.from('cities').select('*').then(({ data }) => {
      if (data) setCities(data);
    });
  }, []);

  const selectedCity = useMemo(() => cities.find(c => c.slug === selected), [cities, selected]);

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Moves</h1>
        <div className="bg-white rounded-xl border p-6">
          <label className="block text-sm font-medium mb-2">Choose your city</label>
          <select
            className="w-full border rounded-lg p-2 mb-4"
            value={selected}
            onChange={(e) => {
              setSelected(e.target.value);
              localStorage.setItem('moves_city', e.target.value);
            }}
          >
            <option value="">Select...</option>
            {cities.map((c) => (
              <option key={c.id} value={c.slug}>{c.name}</option>
            ))}
          </select>
          <div className="flex justify-end">
            {selectedCity ? (
              <Link href={`/${selectedCity.slug}`} className="bg-black text-white px-4 py-2 rounded-lg">Go</Link>
            ) : (
              <button className="bg-gray-300 text-gray-600 px-4 py-2 rounded-lg" disabled>Go</button>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
