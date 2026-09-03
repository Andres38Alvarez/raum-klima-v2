import { NextResponse } from "next/server";

// The OpenAQ v3 API requires a free API key sent server-side (X-API-Key
// header) and does not support CORS, so it cannot be called directly from
// the browser. This route proxies a "nearest station" + "latest readings"
// lookup, keeping the key out of client-side code.
//
// Docs: https://docs.openaq.org/

const OPENAQ_BASE = "https://api.openaq.org/v3";

type OpenAQSensor = {
  id: number;
  parameter: { name: string; units: string; displayName: string };
};

type OpenAQLocation = {
  id: number;
  name: string;
  locality: string | null;
  country: { name: string } | null;
  coordinates: { latitude: number; longitude: number };
  sensors: OpenAQSensor[];
  distance: number | null;
  datetimeLast?: { utc: string | null } | null;
};

type OpenAQLatestResult = {
  sensorsId: number;
  value: number;
  datetime: { utc: string; local: string };
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get("lat");
  const lon = searchParams.get("lon");

  if (!lat || !lon) {
    return NextResponse.json({ error: "lat and lon are required" }, { status: 400 });
  }

  const apiKey = process.env.OPENAQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Air quality data is not configured on this deployment (missing OPENAQ_API_KEY)." },
      { status: 501 },
    );
  }

  const headers = { "X-API-Key": apiKey };

  try {
    const locationsRes = await fetch(
      `${OPENAQ_BASE}/locations?coordinates=${encodeURIComponent(lat)},${encodeURIComponent(lon)}&radius=25000&limit=5&order_by=distance`,
      { headers, next: { revalidate: 0 } },
    );

    if (!locationsRes.ok) {
      return NextResponse.json(
        { error: `OpenAQ locations lookup failed (${locationsRes.status})` },
        { status: 502 },
      );
    }

    const locationsJson = await locationsRes.json();
    const locations: OpenAQLocation[] = locationsJson.results ?? [];

    if (locations.length === 0) {
      return NextResponse.json({ found: false });
    }

    const station = locations[0];

    const latestRes = await fetch(`${OPENAQ_BASE}/locations/${station.id}/latest`, {
      headers,
      next: { revalidate: 0 },
    });

    if (!latestRes.ok) {
      return NextResponse.json(
        { error: `OpenAQ latest-readings lookup failed (${latestRes.status})` },
        { status: 502 },
      );
    }

    const latestJson = await latestRes.json();
    const latestResults: OpenAQLatestResult[] = latestJson.results ?? [];

    const sensorById = new Map(station.sensors.map((s) => [s.id, s]));

    const measurements = latestResults
      .map((r) => {
        const sensor = sensorById.get(r.sensorsId);
        if (!sensor) return null;
        return {
          parameter: sensor.parameter.displayName,
          unit: sensor.parameter.units,
          value: r.value,
          datetime: r.datetime?.utc ?? null,
        };
      })
      .filter((m): m is NonNullable<typeof m> => m !== null);

    return NextResponse.json({
      found: true,
      station: {
        id: station.id,
        name: station.name,
        locality: station.locality,
        country: station.country?.name ?? null,
        distanceMeters: station.distance,
      },
      measurements,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `Air quality lookup failed: ${message}` }, { status: 502 });
  }
}
