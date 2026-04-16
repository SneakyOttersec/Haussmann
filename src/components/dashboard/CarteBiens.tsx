"use client";

import { useEffect, useState, useRef } from "react";
import type { Bien } from "@/types";
import { Card, CardContent } from "@/components/ui/card";

interface PropertyMapProps {
  biens: Bien[];
}

interface GeocodedProperty {
  bien: Bien;
  lat: number;
  lng: number;
}

const GEOCODE_CACHE_KEY = "sci-geocode-cache";

function loadCache(): Record<string, { lat: number; lng: number }> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(GEOCODE_CACHE_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveCache(cache: Record<string, { lat: number; lng: number }>) {
  localStorage.setItem(GEOCODE_CACHE_KEY, JSON.stringify(cache));
}

async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  if (!address.trim()) return null;
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`,
      { headers: { "User-Agent": "Haussmann-SCI-App" } }
    );
    const data = await res.json();
    if (data && data.length > 0) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    }
  } catch {
    // silently fail
  }
  return null;
}

export function CarteBiens({ biens }: PropertyMapProps) {
  const [geocoded, setGeocoded] = useState<GeocodedProperty[]>([]);
  const [mapReady, setMapReady] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);

  // Geocode biens
  useEffect(() => {
    if (biens.length === 0) return;
    const cache = loadCache();
    let cancelled = false;

    async function geocodeAll() {
      const results: GeocodedProperty[] = [];
      let cacheUpdated = false;

      for (const p of biens) {
        if (!p.adresse) continue;
        if (cancelled) break;

        const cached = cache[p.adresse];
        if (cached) {
          results.push({ bien: p, ...cached });
          continue;
        }

        // Rate limit: 1 req/sec for Nominatim
        if (results.length > 0) await new Promise((r) => setTimeout(r, 1100));
        const coords = await geocodeAddress(p.adresse);
        if (coords && !cancelled) {
          cache[p.adresse] = coords;
          cacheUpdated = true;
          results.push({ bien: p, ...coords });
        }
      }

      if (!cancelled) {
        if (cacheUpdated) saveCache(cache);
        setGeocoded(results);
      }
    }

    geocodeAll();
    return () => { cancelled = true; };
  }, [biens]);

  // Initialize Leaflet map
  useEffect(() => {
    if (typeof window === "undefined" || !mapRef.current) return;

    let map: L.Map;

    import("leaflet").then((L) => {
      // Fix default marker icons
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
      }

      map = L.map(mapRef.current!, { zoomControl: true, scrollWheelZoom: true }).setView([46.6, 2.5], 6);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
        maxZoom: 18,
      }).addTo(map);

      leafletMapRef.current = map;
      setMapReady(true);
    });

    return () => {
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
        setMapReady(false);
      }
    };
  }, []);

  // Update markers when geocoded data changes
  useEffect(() => {
    if (!mapReady || !leafletMapRef.current) return;

    import("leaflet").then((L) => {
      const map = leafletMapRef.current!;

      // Clear old markers
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];

      if (geocoded.length === 0) return;

      geocoded.forEach((g) => {
        const marker = L.marker([g.lat, g.lng])
          .addTo(map)
          .bindPopup(`<strong>${g.bien.nom}</strong><br/><span style="font-size:11px;color:#666">${g.bien.adresse}</span>`);
        markersRef.current.push(marker);
      });

      // Always show France view with all markers visible
      const bounds = L.latLngBounds(geocoded.map((g) => [g.lat, g.lng]));
      bounds.extend([41.3, -5.1]); // SW France
      bounds.extend([51.1, 9.6]);  // NE France
      map.fitBounds(bounds, { padding: [20, 20] });
    });
  }, [geocoded, mapReady]);

  if (biens.length === 0 || biens.every((p) => !p.adresse)) return null;

  return (
    <Card className="border-dotted overflow-hidden">
      <CardContent className="p-0">
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <div ref={mapRef} className="w-full h-[280px]" />
      </CardContent>
    </Card>
  );
}
