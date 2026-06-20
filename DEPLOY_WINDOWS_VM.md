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


## Windows user runbook

Use these steps when handing the project to a Windows user who wants to run everything locally but isolated in a Linux environment.

### 1. Choose the Linux environment

Pick one of these options:

- **Hyper-V Ubuntu VM**: best fit when the demo requires a true VM boundary. Enable Hyper-V in "Turn Windows features on or off", create an Ubuntu Server VM, and use the VM console for the Linux commands below.
- **VirtualBox or VMware Ubuntu VM**: good fallback when Hyper-V is unavailable. Configure NAT with port forwarding, or bridged networking if the Windows host and VM can share the LAN.
- **WSL2 Ubuntu**: fastest setup for a hackathon laptop. It is not a full VM in the same sense as Hyper-V/VirtualBox, but it provides a Linux userspace and works well with Docker Desktop.

Recommended VM resources: 2 CPU cores, 4 GB RAM, and 20 GB disk.

### 2. Install Docker in the Linux environment

For an Ubuntu VM, run the following inside the VM:

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl git
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
. /etc/os-release
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" | sudo tee /etc/apt/sources.list.d/docker.list >/dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker "$USER"
newgrp docker
```

For WSL2, install Docker Desktop for Windows, enable the WSL integration for your Ubuntu distro, then run the remaining commands in the Ubuntu terminal.

### 3. Clone the project and select this branch

```bash
git clone <REPO_URL> Futures-Coaching
cd Futures-Coaching
git checkout docker-windows-vm-deploy
```

Replace `<REPO_URL>` with the repository URL you give the Windows user.

### 4. Configure environment variables

```bash
cp .env.example .env
```

The default `.env` keeps AI calls mocked so no secret is needed. To use live Gemini calls, edit `.env` and set:

```dotenv
AI_MOCK=false
GEMINI_API_KEY=your_api_key_here
```

### 5. Start the stack

```bash
docker compose up --build -d
```

Wait for the containers to become healthy:

```bash
docker compose ps
```

### 6. Open the app and metrics from Windows

If you use WSL2 or a VM with localhost forwarding, open these URLs on Windows:

- App: <http://localhost:8080>
- API docs: <http://localhost:8000/docs>
- API health: <http://localhost:8000/health>
- API metrics: <http://localhost:8000/metrics>
- Prometheus: <http://localhost:9090>
- cAdvisor: <http://localhost:8081>
- node-exporter metrics: <http://localhost:9100/metrics>

If `localhost` does not work for a traditional VM, find the VM IP and replace `localhost` with that address:

```bash
hostname -I
```

For NAT-only VirtualBox/VMware networking, add port-forwarding rules from Windows host ports `8080`, `8000`, `9090`, `8081`, and `9100` to the same ports in the VM.

### 7. Seed a demo user

The UI expects at least one user in the backend. Run this inside the Linux environment after the API is healthy:

```bash
curl -X POST http://localhost:8000/users/ \
  -H "Content-Type: application/json" \
  -d '{"username":"demo"}'
```

### 8. Confirm Prometheus is collecting metrics

Open <http://localhost:9090/targets> and confirm that `coach-api`, `linux-vm`, and `containers` are `UP`. Then try these queries in Prometheus:

```promql
sum by (status) (coach_http_requests_total)
rate(coach_http_requests_total[5m])
container_memory_usage_bytes{name!=""}
node_cpu_seconds_total
```

### 9. Stop, restart, or reset

```bash
# Stop containers but keep data
docker compose down

# Restart without rebuilding
docker compose up -d

# Rebuild after code changes
docker compose up --build -d

# Fully reset app SQLite data and Prometheus history
docker compose down -v
```

### 10. Troubleshooting quick checks

```bash
# See logs for a service
docker compose logs -f api
docker compose logs -f web
docker compose logs -f prometheus

# Verify Docker and Compose are installed
docker --version
docker compose version

# Verify ports are listening inside the VM
ss -ltnp | grep -E ':8080|:8000|:9090|:8081|:9100'
```

If cAdvisor fails in a locked-down VM, the app and Prometheus can still run. Comment out the `cadvisor` service and the `containers` scrape job if the VM provider does not allow the required Docker host mounts.

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
