# Homelab Incident Dashboard

A React dashboard for visualizing and managing incidents, events, LLM analysis, and suppression rules from a [Log LLM Watch](../log-llm-watch/) backend.

## Features

- **Live digest** — Overall system health status with LLM-generated summary and recommended actions
- **Incident management** — Browse, filter, search, and drill into incidents with full event timelines
- **LLM analysis** — Trigger on-demand root-cause analysis for any incident, view confidence and evidence
- **Suppression** — Create suppress rules (fingerprint, event class, host, or regex) directly from incident detail, with live regex testing against matched events
- **Event browser** — Search and filter raw log events by host, container, and text with auto-refresh
- **Notification log** — View recent ntfy notification history
- **LLM call log** — Inspect individual LLM calls with duration, tokens, model, and response preview
- **Suppress rule management** — List all active rules with hit counts, delete rules inline
- **Configurable backend URL** — Connect to any Log LLM Watch instance, persisted in localStorage

## Tech Stack

- **React 19** with TypeScript
- **Vite 8** for build and dev server
- **Tailwind CSS 4** for styling
- **shadcn/ui** component library (Card, Button, Input, Badge, ScrollArea, Select, Separator)
- **Framer Motion** for animations
- **Lucide React** for icons

## Project Structure

```
src/
├── main.tsx              # Entry point
├── App.tsx               # Main dashboard component
├── types.ts              # Shared type definitions
├── api.ts                # Fetch wrapper and config constants
├── utils.ts              # Utility functions (formatting, regex, classification)
├── lib/
│   └── utils.ts          # shadcn/ui class merge utility
└── components/ui/        # shadcn/ui components
    ├── badge.tsx
    ├── button.tsx
    ├── card.tsx
    ├── input.tsx
    ├── scroll-area.tsx
    ├── select.tsx
    └── separator.tsx
```

## Setup

### Prerequisites

- Node.js 22+
- A running [Log LLM Watch](../log-llm-watch/) backend

### Development

```bash
npm install
npm run dev
```

The dev server starts at `http://localhost:5173` by default. Set the backend URL in the dashboard UI (defaults to `http://192.168.2.44:8088`).

### Production Build

```bash
npx vite build
```

Static files are output to `dist/`.

### Docker

```bash
docker compose up -d
```

This builds a multi-stage image (Node for build, nginx for serving) and exposes the dashboard on port 3000. The nginx config handles SPA routing and aggressive static asset caching.

```yaml
# docker-compose.yml
services:
  dashboard:
    build: .
    container_name: homelab-incident-dashboard
    ports:
      - "3000:80"
    restart: unless-stopped
```

## API Endpoints Used

The dashboard consumes these endpoints from the Log LLM Watch backend:

| Endpoint | Purpose |
|---|---|
| `GET /api/incidents/open/llm-digest` | Live health digest with summary and recommendations |
| `GET /api/incidents` | Incident listing with status/severity/search filters |
| `GET /api/incidents/{id}` | Incident detail with associated events |
| `GET /api/incidents/{id}/context` | Full investigation context with timeline |
| `PATCH /api/incidents/{id}` | Close or reopen an incident |
| `POST /api/incidents/{id}/analyze` | Trigger LLM root-cause analysis |
| `POST /api/incidents/{id}/suppress` | Create suppress rule and close incident |
| `GET /api/events` | Search raw log events |
| `GET /api/llm-stats` | LLM usage statistics (calls, tokens, latency) |
| `GET /api/llm-log` | Recent LLM call log |
| `GET /api/event-stats` | Event counts, severity/source breakdowns |
| `GET /api/ntfy-log` | Notification delivery log |
| `GET /api/suppress-rules` | Active suppression rules |
| `DELETE /api/suppress-rules/{id}` | Delete a suppression rule |

## License

This project is licensed under the [GNU General Public License v3.0](LICENSE).
