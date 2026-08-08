/**
 * Micro's geography: the bounded area enum, distance maths, and the Web
 * Mercator projection the map pins are placed with. Kept apart from the app so
 * a coordinate question has one place to be answered.
 */

export type LatLng = { lat: number; lng: number };
export type AreaId = "all" | "downtown" | "temescal" | "fruitvale" | "westoak" | "alameda" | "montreal";
export type MicroArea = { id: AreaId; label: string; blurb: string; center: LatLng; zoom: number; minZoom: number; maxZoom: number; spanMi: number };

// Bounded area enum. The user never picks an arbitrary point, so discovery and
// map framing stay inside the launch regions without geocoding free-form text.
export const areas: MicroArea[] = [
  { id: "all", label: "Oakland & Alameda", blurb: "All demo neighborhoods", center: { lat: 37.8045, lng: -122.262 }, zoom: 12, minZoom: 11, maxZoom: 17, spanMi: 9 },
  { id: "downtown", label: "Downtown & Lake Merritt", blurb: "Neighborhood results", center: { lat: 37.8044, lng: -122.2712 }, zoom: 13, minZoom: 12, maxZoom: 18, spanMi: 5 },
  { id: "temescal", label: "Temescal & Rockridge", blurb: "Neighborhood results", center: { lat: 37.838, lng: -122.256 }, zoom: 13, minZoom: 12, maxZoom: 18, spanMi: 5 },
  { id: "fruitvale", label: "Fruitvale & San Antonio", blurb: "Neighborhood results", center: { lat: 37.78, lng: -122.23 }, zoom: 13, minZoom: 12, maxZoom: 18, spanMi: 5 },
  { id: "westoak", label: "West Oakland & Jack London", blurb: "Neighborhood results", center: { lat: 37.803, lng: -122.29 }, zoom: 13, minZoom: 12, maxZoom: 18, spanMi: 5 },
  { id: "alameda", label: "Alameda Island", blurb: "Neighborhood results", center: { lat: 37.765, lng: -122.245 }, zoom: 13, minZoom: 12, maxZoom: 18, spanMi: 5 },
  { id: "montreal", label: "Island of Montréal", blurb: "Montréal, QC", center: { lat: 45.519, lng: -73.585 }, zoom: 12, minZoom: 10, maxZoom: 18, spanMi: 16 },
];

// Panning is fenced to the chosen area so the map cannot wander off to another
// city; zoom is clamped so it can neither leave the area nor dive past street level.
export function areaBounds(area: MicroArea) {
  const latSpan = area.spanMi / 69;
  const lngSpan = area.spanMi / (69 * Math.cos((area.center.lat * Math.PI) / 180));
  return {
    north: area.center.lat + latSpan,
    south: area.center.lat - latSpan,
    east: area.center.lng + lngSpan,
    west: area.center.lng - lngSpan,
  };
}

export function areaById(id: AreaId): MicroArea {
  return areas.find((area) => area.id === id) ?? areas[0];
}

export function areaIdFromServiceArea(value?: string | null): AreaId {
  if (!value) return "all";
  const normalized = value.trim().toLowerCase();
  return areas.find((area) => area.id === normalized || area.label.toLowerCase() === normalized)?.id ?? "all";
}

/**
 * The launch area a real coordinate falls in, or undefined when it is outside
 * every one of them. "all" is skipped: it is the whole-region framing rather
 * than a neighborhood, so it would swallow every point in Oakland.
 */
export function areaForPoint(point: LatLng): MicroArea | undefined {
  return areas
    .filter((area) => area.id !== "all")
    .map((area) => ({ area, miles: distanceMiles(area.center, point) }))
    .filter(({ area, miles }) => miles <= area.spanMi)
    .sort((first, second) => first.miles - second.miles)[0]?.area;
}

/**
 * Ask the device where it is. Wrapped so the callers deal in one promise and
 * one plain-language failure instead of the callback API and its error codes.
 */
function locateOnce(options: PositionOptions): Promise<{ point?: LatLng; code?: number }> {
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ point: { lat: position.coords.latitude, lng: position.coords.longitude } }),
      (error) => resolve({ code: error.code }),
      options,
    );
  });
}

/**
 * Micro only ever draws a listing inside a 0.35-mile circle, so street-level
 * precision buys nothing. High accuracy asks for GPS, which a laptop does not
 * have — it falls back to wifi positioning anyway, just slower and more likely
 * to time out. So the coarse, fast fix is tried first and the precise one only
 * as a fallback.
 */
export async function readDeviceLocation(): Promise<{ point?: LatLng; error?: string }> {
  if (!navigator.geolocation) return { error: "This browser cannot share a location." };

  const coarse = await locateOnce({ enableHighAccuracy: false, timeout: 12000, maximumAge: 600000 });
  if (coarse.point) return { point: coarse.point };
  if (coarse.code === 1) return { error: "Location permission was declined. Your approximate area is used instead." };

  const precise = await locateOnce({ enableHighAccuracy: true, timeout: 15000, maximumAge: 600000 });
  if (precise.point) return { point: precise.point };
  if (precise.code === 1) return { error: "Location permission was declined. Your approximate area is used instead." };

  return {
    error: precise.code === 3
      ? "Finding your location timed out. On a Mac, check System Settings → Privacy & Security → Location Services is on for your browser."
      : "Your device could not report a location. Your approximate area is used instead.",
  };
}

export function distanceMiles(from: LatLng, to: LatLng) {
  const earthRadiusMiles = 3958.8;
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const deltaLat = toRadians(to.lat - from.lat);
  const deltaLng = toRadians(to.lng - from.lng);
  const haversine =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(toRadians(from.lat)) * Math.cos(toRadians(to.lat)) * Math.sin(deltaLng / 2) ** 2;
  return 2 * earthRadiusMiles * Math.asin(Math.sqrt(haversine));
}

export function formatDistance(miles: number) {
  return miles < 0.1 ? "under 0.1 mi" : `${miles.toFixed(1)} mi`;
}

export const mapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? import.meta.env.VITE_GOOGLE_MAPS_STATIC_KEY ?? "";
// Advanced (HTML) markers require a cloud-configured Map ID. DEMO_MAP_ID works
// for development; a real Map ID should be created before any deploy.
export const mapsMapId = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID ?? "DEMO_MAP_ID";

// Web Mercator, matching how Google frames a static map, so a task coordinate
// becomes a pixel offset from the requested centre.
export function projectToWorld(point: LatLng) {
  const clampedSin = Math.min(Math.max(Math.sin((point.lat * Math.PI) / 180), -0.9999), 0.9999);
  return {
    x: 256 * (0.5 + point.lng / 360),
    y: 256 * (0.5 - Math.log((1 + clampedSin) / (1 - clampedSin)) / (4 * Math.PI)),
  };
}

export function pixelOffsetFromCenter(point: LatLng, center: LatLng, zoom: number) {
  const worldScale = 2 ** zoom;
  const projected = projectToWorld(point);
  const projectedCenter = projectToWorld(center);
  return { x: (projected.x - projectedCenter.x) * worldScale, y: (projected.y - projectedCenter.y) * worldScale };
}

export function staticMapUrl(center: LatLng, zoom: number, width: number, height: number) {
  if (!mapsApiKey) return "";
  const params = new URLSearchParams({
    center: `${center.lat},${center.lng}`,
    zoom: String(zoom),
    size: `${width}x${height}`,
    scale: "2",
    maptype: "roadmap",
    key: mapsApiKey,
  });
  const styles = [
    "feature:poi|visibility:off",
    "feature:transit|visibility:off",
    "feature:road|element:labels.icon|visibility:off",
  ];
  return `https://maps.googleapis.com/maps/api/staticmap?${params}&${styles.map((style) => `style=${encodeURIComponent(style)}`).join("&")}`;
}

/**
 * Turns a typed address into a point, so a poster who cannot or will not share
 * a device location can still place their task properly.
 *
 * Bounded to Micro's service area and run once on demand — never per keystroke —
 * so this stays a single lookup rather than a stream of billed calls. Needs the
 * Geocoding API enabled on the same key that draws the map; when it is not, the
 * caller is told exactly that rather than being left with a dead field.
 */
export async function locateAddress(address: string): Promise<{ point?: LatLng; error?: string }> {
  type GeocodeHit = { geometry: { location: { lat: () => number; lng: () => number } } };
  type MinimalGeocoder = { geocode: (request: Record<string, unknown>, callback: (results: GeocodeHit[] | null, status: string) => void) => void };
  const maps = (window as unknown as { google?: { maps?: { Geocoder?: new () => MinimalGeocoder } } }).google?.maps;
  if (!maps?.Geocoder) return { error: "The map has not finished loading. Open Nearby once, then try again." };

  const geocoder = new maps.Geocoder();
  const { status, point } = await new Promise<{ status: string; point?: LatLng }>((resolve) => {
    geocoder.geocode({ address, componentRestrictions: { country: "us" } }, (results: GeocodeHit[] | null, geocodeStatus: string) => {
      const first = results?.[0];
      resolve({
        status: geocodeStatus,
        point: first ? { lat: first.geometry.location.lat(), lng: first.geometry.location.lng() } : undefined,
      });
    });
  });

  if (point) {
    return areaForPoint(point)
      ? { point }
      : { error: "That address is outside Micro's neighborhoods, so your area is used instead." };
  }
  if (status === "ZERO_RESULTS") return { error: "No match for that address. Add the city, or pick your neighborhood below." };
  if (status === "REQUEST_DENIED") return { error: "Address lookup is not enabled on this project's Google key. Pick your neighborhood below instead." };
  if (status === "OVER_QUERY_LIMIT") return { error: "Address lookup is over its quota for now. Pick your neighborhood below instead." };
  return { error: "That address could not be looked up. Pick your neighborhood below instead." };
}
