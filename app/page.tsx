"use client";

import { useEffect, useRef, useState } from "react";
import { describeWeatherCode } from "@/lib/weather-codes";

type GeoResult = {
  id: number;
  name: string;
  country: string | null;
  admin1: string | null;
  latitude: number;
  longitude: number;
};

type CurrentWeather = {
  temperature_2m: number;
  relative_humidity_2m: number;
  apparent_temperature: number;
  weather_code: number;
  wind_speed_10m: number;
};

type DailyForecast = {
  time: string[];
  temperature_2m_max: number[];
  temperature_2m_min: number[];
  weather_code: number[];
};

type AirQualityMeasurement = {
  parameter: string;
  unit: string;
  value: number;
  datetime: string | null;
};

type AirQualityResponse =
  | { found: false }
  | {
      found: true;
      station: {
        id: number;
        name: string;
        locality: string | null;
        country: string | null;
        distanceMeters: number | null;
      };
      measurements: AirQualityMeasurement[];
    }
  | { error: string };

function IconThermometer() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z" />
    </svg>
  );
}

function IconDroplet() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2.69s5 5.06 5 9.86a5 5 0 0 1-10 0c0-4.8 5-9.86 5-9.86Z" />
    </svg>
  );
}

function IconWind() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.6 4.6A2 2 0 1 1 11 8H2" />
      <path d="M12.6 19.4A2 2 0 1 0 14 16H2" />
      <path d="M17.7 7.7A2.5 2.5 0 1 1 19.5 12H2" />
    </svg>
  );
}

function IconLeaf() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 20A7 7 0 0 1 4 13V8a4 4 0 0 1 4-4h4a7 7 0 0 1 7 7v0a7 7 0 0 1-7 7H4" />
      <path d="M4 13c4.5 0 6-2 9-6" />
    </svg>
  );
}

function pm25Badge(value: number): { label: string; cls: string } {
  if (value <= 12) return { label: "Good", cls: "good" };
  if (value <= 35.4) return { label: "Moderate", cls: "moderate" };
  return { label: "Poor", cls: "poor" };
}

function formatDay(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short" });
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<GeoResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [place, setPlace] = useState<GeoResult | null>(null);

  const [current, setCurrent] = useState<CurrentWeather | null>(null);
  const [daily, setDaily] = useState<DailyForecast | null>(null);
  const [airQuality, setAirQuality] = useState<AirQualityResponse | null>(null);

  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=6&language=en&format=json`,
        );
        const json = await res.json();
        const results: GeoResult[] = (json.results ?? []).map((r: any) => ({
          id: r.id,
          name: r.name,
          country: r.country ?? null,
          admin1: r.admin1 ?? null,
          latitude: r.latitude,
          longitude: r.longitude,
        }));
        setSuggestions(results);
      } catch {
        setSuggestions([]);
      }
    }, 300);
  }, [query]);

  async function selectPlace(p: GeoResult) {
    setPlace(p);
    setQuery(`${p.name}${p.admin1 ? ", " + p.admin1 : ""}${p.country ? ", " + p.country : ""}`);
    setShowSuggestions(false);
    setSuggestions([]);
    setWeatherLoading(true);
    setWeatherError(null);
    setCurrent(null);
    setDaily(null);
    setAirQuality(null);

    try {
      const weatherRes = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${p.latitude}&longitude=${p.longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,weather_code&timezone=auto&forecast_days=6`,
      );
      if (!weatherRes.ok) throw new Error(`Weather lookup failed (${weatherRes.status})`);
      const weatherJson = await weatherRes.json();
      setCurrent(weatherJson.current);
      setDaily(weatherJson.daily);
    } catch (err) {
      setWeatherError(err instanceof Error ? err.message : "Weather lookup failed");
    } finally {
      setWeatherLoading(false);
    }

    try {
      const aqRes = await fetch(`/api/air-quality?lat=${p.latitude}&lon=${p.longitude}`);
      const aqJson = await aqRes.json();
      setAirQuality(aqJson);
    } catch {
      setAirQuality({ error: "Air quality lookup failed" });
    }
  }

  return (
    <>
      <header className="top">
        <span className="brand">Raum Klima</span>
        <span className="sub">Global Environmental Dashboard — live public data</span>
      </header>

      <div className="wrap">
        <div className="eyebrow">Search a location</div>
        <div className="search-row">
          <input
            className="search-input"
            type="text"
            placeholder="City, region or country…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
          />
          {showSuggestions && suggestions.length > 0 && (
            <div className="suggestions">
              {suggestions.map((s) => (
                <button
                  key={s.id}
                  className="suggestion"
                  onClick={() => selectPlace(s)}
                  type="button"
                >
                  <span>{s.name}</span>
                  <span className="place-country">
                    {[s.admin1, s.country].filter(Boolean).join(", ")}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {!place && (
          <div className="empty-state">
            Search for a city to see its current temperature, humidity, and nearby air-quality readings.
          </div>
        )}

        {weatherLoading && <div className="loading-state">Loading…</div>}
        {weatherError && <div className="error-state">{weatherError}</div>}

        {place && current && (
          <div className="card">
            <div className="eyebrow">Current conditions — {place.name}</div>
            <div className="current-grid">
              <div>
                <span className="temp-value">{Math.round(current.temperature_2m)}</span>
                <span className="temp-unit">°C</span>
                <div className="condition">{describeWeatherCode(current.weather_code)}</div>
              </div>
              <div className="metrics">
                <span className="metric">
                  <IconThermometer /> Feels like {Math.round(current.apparent_temperature)}°C
                </span>
                <span className="metric">
                  <IconDroplet /> {Math.round(current.relative_humidity_2m)}% humidity
                </span>
                <span className="metric">
                  <IconWind /> {Math.round(current.wind_speed_10m)} km/h wind
                </span>
              </div>
            </div>
          </div>
        )}

        {place && daily && (
          <div className="card">
            <div className="eyebrow">Next days</div>
            <div className="forecast-strip">
              {daily.time.map((t, i) => (
                <div className="forecast-day" key={t}>
                  <div className="day-label">{i === 0 ? "Today" : formatDay(t)}</div>
                  <div className="condition" style={{ fontSize: 12, marginBottom: 4 }}>
                    {describeWeatherCode(daily.weather_code[i])}
                  </div>
                  <div className="day-temps">
                    {Math.round(daily.temperature_2m_max[i])}°{" "}
                    <span className="lo">{Math.round(daily.temperature_2m_min[i])}°</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {place && airQuality && (
          <div className="card">
            <div className="eyebrow">
              <IconLeaf /> Air quality
            </div>
            {"error" in airQuality && (
              <div className="empty-state">{airQuality.error}</div>
            )}
            {"found" in airQuality && airQuality.found === false && (
              <div className="empty-state">No OpenAQ monitoring station found within 25 km of this location.</div>
            )}
            {"found" in airQuality && airQuality.found === true && (
              <>
                <div className="pollutant-grid">
                  {airQuality.measurements.map((m) => {
                    const badge = m.parameter === "PM2.5" ? pm25Badge(m.value) : null;
                    return (
                      <div className="pollutant" key={m.parameter}>
                        <div className="name">{m.parameter}</div>
                        <div className="value">
                          {m.value.toFixed(1)}
                          <span className="unit">{m.unit}</span>
                        </div>
                        {badge && (
                          <div style={{ marginTop: 6 }}>
                            <span className={`badge ${badge.cls}`}>{badge.label}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {airQuality.measurements.length === 0 && (
                    <div className="empty-state">Station found, but no recent readings available.</div>
                  )}
                </div>
                <div className="station-meta">
                  Nearest station: {airQuality.station.name}
                  {airQuality.station.locality ? `, ${airQuality.station.locality}` : ""}
                  {airQuality.station.distanceMeters != null
                    ? ` (${(airQuality.station.distanceMeters / 1000).toFixed(1)} km away)`
                    : ""}{" "}
                  — data via{" "}
                  <a href="https://openaq.org" target="_blank" rel="noopener">
                    OpenAQ
                  </a>
                  .
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <footer className="disclaimer">
        <p>
          Weather and forecast data from{" "}
          <a href="https://open-meteo.com" target="_blank" rel="noopener">
            Open-Meteo
          </a>
          . Air-quality readings from real monitoring stations via{" "}
          <a href="https://openaq.org" target="_blank" rel="noopener">
            OpenAQ
          </a>
          . This is an independent portfolio project, not affiliated with either provider. PM2.5
          categories use simplified US EPA breakpoints for illustration and are not a substitute
          for official air-quality guidance.
        </p>
      </footer>
    </>
  );
}
