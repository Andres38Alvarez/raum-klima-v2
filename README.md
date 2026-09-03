# Raum Klima — Global Environmental Dashboard

A software-only reimagining of the original [Raum Klima](../andres-portfolio/papers/Raum-Klima-IoT-Environmental-Monitoring.docx)
IoT project (ESP8266 + DHT22 + MQ135). Instead of reading from a physical
sensor that has to stay powered on and network-reachable, this version
looks up live temperature, humidity, forecast, and air-quality data for
any location in the world, using two free public APIs:

- **[Open-Meteo](https://open-meteo.com/)** — weather and geocoding.
  Free, no API key, CORS-enabled, called directly from the browser.
- **[OpenAQ](https://openaq.org/)** — real air-quality monitoring
  stations worldwide. Requires a free API key and does not support CORS,
  so it's called through a small server-side proxy route
  (`/api/air-quality`) that keeps the key out of client-side code.

There is no database. The app is fully stateless — every request just
proxies or queries a public API live — which avoids the "free-tier
database expired" problem entirely.

## Running locally

```bash
npm install
npm run dev
```

Open http://localhost:3000.

Air-quality lookups need an `OPENAQ_API_KEY` environment variable (a
free key from https://explore.openaq.org/register). Without it, the app
still works for weather/forecast; the air-quality card will show a
"not configured" message instead of failing.

Create `.env.local`:

```
OPENAQ_API_KEY=your-key-here
```

## Deploying (Vercel)

1. Push this repo to GitHub.
2. Create a new Vercel project from that repo. No build settings need
   to change — it's a stock Next.js app.
3. Add the `OPENAQ_API_KEY` environment variable in Vercel's project
   settings (Production).
4. Deploy.

No database, no cron jobs, nothing else to configure.
