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
SERVER_PID="$PID_DIR/server.pid"
CLIENT_PID="$PID_DIR/client.pid"
SERVER_LOG="$PID_DIR/server.log"
CLIENT_LOG="$PID_DIR/client.log"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

mkdir -p "$PID_DIR"
LOCAL_IP=$(ipconfig getifaddr en0 || ipconfig getifaddr en1 || echo "localhost")


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
    # Wait up to 10 seconds for MySQL to become ready
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

# ── Start ────────────────────────────────────────────────────────
start() {
  echo -e "${CYAN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${CYAN}${BOLD}  🚀 CryoChain — Starting All Services${NC}"
  echo -e "${CYAN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

  # 1. MySQL
  start_mysql

  # 2. Node/Express Server
  if [ -f "$SERVER_PID" ] && kill -0 "$(cat "$SERVER_PID")" 2>/dev/null; then
    echo -e "  Server: ${YELLOW}⚠️  Already running (PID $(cat "$SERVER_PID"))${NC}"
  else
    cd "$SCRIPT_DIR/server"
    nohup npm run dev > "$SERVER_LOG" 2>&1 &
    echo $! > "$SERVER_PID"
    echo -e "  Server: ${GREEN}✅ Started on http://$LOCAL_IP:5001 (PID $!)${NC}"
    cd "$SCRIPT_DIR"
  fi

  # 3. React Client
  if [ -f "$CLIENT_PID" ] && kill -0 "$(cat "$CLIENT_PID")" 2>/dev/null; then
    echo -e "  Client: ${YELLOW}⚠️  Already running (PID $(cat "$CLIENT_PID"))${NC}"
  else
    cd "$SCRIPT_DIR/client"
    BROWSER=none nohup npm start > "$CLIENT_LOG" 2>&1 &
    echo $! > "$CLIENT_PID"
    echo -e "  Client: ${GREEN}✅ Started on http://$LOCAL_IP:3000 (PID $!)${NC}"
    cd "$SCRIPT_DIR"
  fi

  echo -e "${CYAN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "  Logs:   ${YELLOW}.pids/server.log${NC} | ${YELLOW}.pids/client.log${NC}"
  echo -e "  App:    ${GREEN}http://$LOCAL_IP:3000${NC}"
  echo -e "  Login:  ${GREEN}admin@cryochain.io${NC} / ${GREEN}Admin@1234${NC}"
  echo -e "${CYAN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# ── Kill by port helper ──────────────────────────────────────────
kill_port() {
  local PORT=$1
  local NAME=$2
  local PIDS
  PIDS=$(lsof -ti :"$PORT" 2>/dev/null)
  if [ -n "$PIDS" ]; then
    echo "$PIDS" | xargs kill -9 2>/dev/null
    echo -e "  $NAME: ${RED}🛑 Stopped (port $PORT, PID $PIDS)${NC}"
  else
    echo -e "  $NAME: ${YELLOW}⚠️  Nothing running on port $PORT${NC}"
  fi
}

# ── Kill by process name helper ──────────────────────────────────
kill_proc() {
  local PATTERN=$1
  pkill -f "$PATTERN" 2>/dev/null
}

# ── Stop ─────────────────────────────────────────────────────────
stop() {
  echo -e "${CYAN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${CYAN}${BOLD}  🛑 CryoChain — Stopping All Services${NC}"
  echo -e "${CYAN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

  # 1. React Client — kill by port 3000 AND process name
  kill_port 3000 "Client"
  kill_proc "react-scripts/scripts/start" 2>/dev/null
  rm -f "$CLIENT_PID"

  # 2. Node/Express Server — kill by port 5001 AND nodemon
  kill_port 5001 "Server"
  kill_proc "nodemon server.js" 2>/dev/null
  rm -f "$SERVER_PID"

  # 3. MySQL
  stop_mysql

  echo -e "${CYAN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# ── Status ───────────────────────────────────────────────────────
status() {
  echo -e "${CYAN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${CYAN}${BOLD}  📊 CryoChain — Service Status${NC}"
  echo -e "${CYAN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

  if mysql_running; then
    echo -e "  MySQL:  ${GREEN}● RUNNING${NC}"
  else
    echo -e "  MySQL:  ${RED}○ STOPPED${NC}"
  fi

  if [ -f "$SERVER_PID" ] && kill -0 "$(cat "$SERVER_PID")" 2>/dev/null; then
    echo -e "  Server: ${GREEN}● RUNNING${NC} (PID $(cat "$SERVER_PID")) → http://$LOCAL_IP:5001"
  else
    echo -e "  Server: ${RED}○ STOPPED${NC}"
  fi

  if [ -f "$CLIENT_PID" ] && kill -0 "$(cat "$CLIENT_PID")" 2>/dev/null; then
    echo -e "  Client: ${GREEN}● RUNNING${NC} (PID $(cat "$CLIENT_PID")) → http://$LOCAL_IP:3000"
  else
    echo -e "  Client: ${RED}○ STOPPED${NC}"
  fi

  echo -e "${CYAN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# ── Main ─────────────────────────────────────────────────────────
case "$1" in
  start)   start  ;;
  stop)    stop   ;;
  status)  status ;;
  restart) stop; sleep 1; start ;;
  *)
    echo -e "${YELLOW}Usage: ./cryochain.sh {start|stop|restart|status}${NC}"
    exit 1
    ;;
esac
