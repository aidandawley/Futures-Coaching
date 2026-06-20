# Windows host + Linux VM Docker deployment

This repo now ships a self-contained Docker Compose stack for running the old Vercel/Render-style app on a personal Windows machine inside a Linux VM. The stack keeps the app local by default and exposes security/operations metrics that agents can scrape.

## What runs

| Service | URL on Windows host | Purpose |
| --- | --- | --- |
| `web` | <http://localhost:8080> | React/Vite app served by Nginx |
| `api` | <http://localhost:8000> | FastAPI backend and OpenAPI docs at `/docs` |
| `prometheus` | <http://localhost:9090> | Scrapes app, VM, and container metrics |
| `node-exporter` | <http://localhost:9100/metrics> | Linux VM host metrics |
| `cadvisor` | <http://localhost:8081> | Docker container metrics |

The app API exposes Prometheus-format metrics at <http://localhost:8000/metrics> and a health endpoint at <http://localhost:8000/health>.

## Recommended VM setup

1. Install a Linux VM on the Windows machine, such as Ubuntu Server 24.04 in Hyper-V, VirtualBox, VMware, or WSL2 if a full VM is not required by your demo constraints.
2. Give the VM at least 2 CPU cores, 4 GB RAM, and 20 GB disk.
3. Install Docker Engine and the Docker Compose plugin in the VM.
4. Clone this repo inside the VM.
5. If your VM uses NAT networking, forward host ports `8080`, `8000`, `9090`, `9100`, and `8081` from Windows to the VM, or access the app through the VM IP.

## Run it

```bash
cp .env.example .env
# Optional: edit .env and set GEMINI_API_KEY plus AI_MOCK=false for live AI calls.
docker compose up --build -d
```

Check health:

```bash
docker compose ps
curl http://localhost:8080/health
curl http://localhost:8000/health
curl http://localhost:8000/metrics
```

Seed the demo user if needed:

```bash
curl -X POST http://localhost:8000/users/ \
  -H "Content-Type: application/json" \
  -d '{"username":"demo"}'
```

Stop the stack:

```bash
docker compose down
```

Remove persisted SQLite and Prometheus data:

```bash
docker compose down -v
```

## Metrics available for the security-agent hackathon

Prometheus is configured in `deploy/prometheus/prometheus.yml` to scrape:

- `coach-api`: app-level request counters and route latency from `/metrics`.
- `linux-vm`: CPU, memory, disk, network, and OS metrics from node-exporter.
- `containers`: per-container CPU, memory, filesystem, and network metrics from cAdvisor.

Useful starter queries:

```promql
sum by (status) (coach_http_requests_total)
rate(coach_http_requests_total[5m])
rate(container_cpu_usage_seconds_total{name!=""}[5m])
container_memory_usage_bytes{name!=""}
node_filesystem_avail_bytes{mountpoint="/"}
```

## Notes for a personal-machine demo

- Keep this stack bound to localhost or the VM-only network unless you intentionally want LAN access.
- `AI_MOCK=true` is the default so the app can run without external API keys.
- The backend stores SQLite data in the `coach-data` Docker volume.
- The frontend talks to the backend through Nginx at `/api`, so no Vercel-specific runtime config is required.
