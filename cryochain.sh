#!/bin/bash
# ================================================================
#  CryoChain — Start / Stop Script (Bash Utility)
#
#  This script orchestrates the entire application environment.
#  Instead of manually opening 3 terminal tabs to run the backend,
#  frontend, and database separately, this script handles background 
#  spawning (using 'nohup') and process management (PID files).
#
#  Usage (run from the project1 folder):
#    ./cryochain.sh start   → starts MySQL + server (5001) + client (3000)
#    ./cryochain.sh stop    → gracefully stops client, server, and MySQL
#    ./cryochain.sh restart → stop then start everything
#    ./cryochain.sh status  → shows running status of all services
# ================================================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PID_DIR="$SCRIPT_DIR/.pids"

# Ensure Homebrew and common paths are included
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

SERVER_PID="$PID_DIR/server.pid"
CLIENT_PID="$PID_DIR/client.pid"
SERVER_LOG="$PID_DIR/server.log"
CLIENT_LOG="$PID_DIR/client.log"
TUNNEL_SERVER_PID="$PID_DIR/tunnel_server.pid"
TUNNEL_CLIENT_PID="$PID_DIR/tunnel_client.pid"
TUNNEL_SERVER_LOG="$PID_DIR/tunnel_server.log"
TUNNEL_CLIENT_LOG="$PID_DIR/tunnel_client.log"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

mkdir -p "$PID_DIR"
LOCAL_IP=$(ipconfig getifaddr en0 || ipconfig getifaddr en1 || echo "localhost")
USE_PUBLIC=false

# ── MySQL helpers ────────────────────────────────────────────────
mysql_running() {
  mysqladmin -u root ping --silent 2>/dev/null
}

start_mysql() {
  if mysql_running; then
    echo -e "  MySQL:  ${YELLOW}⚠️  Already running${NC}"
  else
    echo -e "  MySQL:  ${CYAN}Starting...${NC}"
    brew services start mysql 2>/dev/null || mysql.server start 2>/dev/null
    for i in {1..10}; do
      sleep 1
      if mysql_running; then
        echo -e "  MySQL:  ${GREEN}✅ Started${NC}"
        return
      fi
    done
    echo -e "  MySQL:  ${RED}❌ Failed to start — check MySQL installation${NC}"
  fi
}

stop_mysql() {
  if mysql_running; then
    brew services stop mysql 2>/dev/null || mysql.server stop 2>/dev/null
    echo -e "  MySQL:  ${RED}🛑 Stopped${NC}"
  else
    echo -e "  MySQL:  ${YELLOW}⚠️  Was not running${NC}"
  fi
}

# ── Tunnel helpers ───────────────────────────────────────────────
start_tunnel() {
  local PORT=$1
  local PID_FILE=$2
  local LOG_FILE=$3

  rm -f "$LOG_FILE"
  # Use npx -y to skip confirmation
  nohup npx -y localtunnel --port "$PORT" > "$LOG_FILE" 2>&1 &
  echo $! > "$PID_FILE"
  
  for i in {1..20}; do
    sleep 1
    local URL=$(grep "your url is:" "$LOG_FILE" | cut -d' ' -f4)
    if [ -n "$URL" ]; then
      echo "$URL"
      return
    fi
  done
  echo "FAILED"
}

# ── Start ────────────────────────────────────────────────────────
start() {
  echo -e "${CYAN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${CYAN}${BOLD}  🚀 CryoChain — Starting All Services${NC}"
  echo -e "${CYAN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

  start_mysql

  local SERVER_PUBLIC=""
  if [ "$USE_PUBLIC" = true ]; then
    echo -e "  Tunnel: ${CYAN}Creating public tunnel for Server...${NC}"
    SERVER_PUBLIC=$(start_tunnel 5001 "$TUNNEL_SERVER_PID" "$TUNNEL_SERVER_LOG")
    if [ "$SERVER_PUBLIC" != "FAILED" ]; then
      echo -e "  Tunnel: ${GREEN}✅ Server Public: $SERVER_PUBLIC${NC}"
      export REACT_APP_API_URL="$SERVER_PUBLIC"
    else
      echo -e "  Tunnel: ${RED}❌ Server Tunnel failed (check logs: $TUNNEL_SERVER_LOG)${NC}"
    fi
  fi

  if [ -f "$SERVER_PID" ] && kill -0 "$(cat "$SERVER_PID")" 2>/dev/null; then
    echo -e "  Server: ${YELLOW}⚠️  Already running (PID $(cat "$SERVER_PID"))${NC}"
  else
    cd "$SCRIPT_DIR/server"
    nohup npm run dev > "$SERVER_LOG" 2>&1 &
    echo $! > "$SERVER_PID"
    echo -e "  Server: ${GREEN}✅ Started on http://$LOCAL_IP:5001 (LAN) | http://localhost:5001 (Local)${NC}"
    cd "$SCRIPT_DIR"
  fi

  local CLIENT_PUBLIC=""
  if [ "$USE_PUBLIC" = true ]; then
    echo -e "  Tunnel: ${CYAN}Creating public tunnel for Client...${NC}"
    CLIENT_PUBLIC=$(start_tunnel 3000 "$TUNNEL_CLIENT_PID" "$TUNNEL_CLIENT_LOG")
    if [ "$CLIENT_PUBLIC" != "FAILED" ]; then
      echo -e "  Tunnel: ${GREEN}✅ Client Public: $CLIENT_PUBLIC${NC}"
    else
      echo -e "  Tunnel: ${RED}❌ Client Tunnel failed (check logs: $TUNNEL_CLIENT_LOG)${NC}"
    fi
  fi

  if [ -f "$CLIENT_PID" ] && kill -0 "$(cat "$CLIENT_PID")" 2>/dev/null; then
    echo -e "  Client: ${YELLOW}⚠️  Already running (PID $(cat "$CLIENT_PID"))${NC}"
  else
    cd "$SCRIPT_DIR/client"
    [ -n "$SERVER_PUBLIC" ] && export REACT_APP_API_URL="$SERVER_PUBLIC"
    BROWSER=none nohup npm start > "$CLIENT_LOG" 2>&1 &
    echo $! > "$CLIENT_PID"
    echo -e "  Client: ${GREEN}✅ Started on http://$LOCAL_IP:3000 (LAN) | http://localhost:3000 (Local)${NC}"
    cd "$SCRIPT_DIR"
  fi

  echo -e "${CYAN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "  Logs:   ${YELLOW}.pids/server.log${NC} | ${YELLOW}.pids/client.log${NC}"
  echo -e "  App:    ${GREEN}http://$LOCAL_IP:3000 (LAN) | http://localhost:3000 (Local)${NC}"
  if [ -n "$CLIENT_PUBLIC" ]; then
    echo -e "  Public: ${CYAN}${BOLD}$CLIENT_PUBLIC (External)${NC}"
  fi
  echo -e "  Login:  ${GREEN}admin@cryochain.io${NC} / ${GREEN}Admin@1234${NC}"
  echo -e "${CYAN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "  ${YELLOW}Tip: Share the Public URL with people not on your LAN!${NC}"
  echo -e "${CYAN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# ── Stop ─────────────────────────────────────────────────────────
stop() {
  echo -e "${CYAN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${CYAN}${BOLD}  🛑 CryoChain — Stopping All Services${NC}"
  echo -e "${CYAN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

  PIDS=$(lsof -ti :3000 2>/dev/null)
  if [ -n "$PIDS" ]; then
    echo "$PIDS" | xargs kill -9 2>/dev/null
    echo -e "  Client: ${RED}🛑 Stopped${NC}"
  fi
  pkill -f "react-scripts/scripts/start" 2>/dev/null
  rm -f "$CLIENT_PID"

  PIDS=$(lsof -ti :5001 2>/dev/null)
  if [ -n "$PIDS" ]; then
    echo "$PIDS" | xargs kill -9 2>/dev/null
    echo -e "  Server: ${RED}🛑 Stopped${NC}"
  fi
  pkill -f "nodemon server.js" 2>/dev/null
  rm -f "$SERVER_PID"

  if [ -f "$TUNNEL_CLIENT_PID" ]; then
    kill "$(cat "$TUNNEL_CLIENT_PID")" 2>/dev/null
    rm -f "$TUNNEL_CLIENT_PID"
    echo -e "  Tunnel (Client): ${RED}🛑 Stopped${NC}"
  fi
  if [ -f "$TUNNEL_SERVER_PID" ]; then
    kill "$(cat "$TUNNEL_SERVER_PID")" 2>/dev/null
    rm -f "$TUNNEL_SERVER_PID"
    echo -e "  Tunnel (Server): ${RED}🛑 Stopped${NC}"
  fi

  stop_mysql
  echo -e "${CYAN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# ── Status ───────────────────────────────────────────────────────
status() {
  echo -e "${CYAN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "  📊 CryoChain — Service Status"
  echo -e "${CYAN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

  if mysql_running; then echo -e "  MySQL:  ${GREEN}● RUNNING${NC}"; else echo -e "  MySQL:  ${RED}○ STOPPED${NC}"; fi
  if [ -f "$SERVER_PID" ] && kill -0 "$(cat "$SERVER_PID")" 2>/dev/null; then echo -e "  Server: ${GREEN}● RUNNING${NC}"; else echo -e "  Server: ${RED}○ STOPPED${NC}"; fi
  if [ -f "$CLIENT_PID" ] && kill -0 "$(cat "$CLIENT_PID")" 2>/dev/null; then echo -e "  Client: ${GREEN}● RUNNING${NC}"; else echo -e "  Client: ${RED}○ STOPPED${NC}"; fi
  if [ -f "$TUNNEL_CLIENT_PID" ] && kill -0 "$(cat "$TUNNEL_CLIENT_PID")" 2>/dev/null; then echo -e "  Public: ${GREEN}● ACTIVE${NC}"; fi
  echo -e "${CYAN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# ── Main ─────────────────────────────────────────────────────────
for arg in "$@"; do
  if [ "$arg" == "--public" ]; then USE_PUBLIC=true; break; fi
done

case "$1" in
  start)   start  ;;
  stop)    stop   ;;
  status)  status ;;
  restart) stop; sleep 1; start ;;
  *)
    echo -e "${YELLOW}Usage: ./cryochain.sh {start|stop|restart|status} [--public]${NC}"
    exit 1
    ;;
esac
