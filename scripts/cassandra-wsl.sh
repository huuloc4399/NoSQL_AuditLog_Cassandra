#!/usr/bin/env bash
set -euo pipefail

version=4.1.12
runtime="${CASSANDRA_RUNTIME_DIR:-${XDG_DATA_HOME:-$HOME/.local/share}/auditflow-cassandra}"
node="$runtime/apache-cassandra-$version"
action="${1:-start}"

# Bản Cassandra 4.1 chỉ tự ghi PID trong chế độ nền. Tìm đúng Java của runtime
# để nhận diện cả tiến trình foreground cũ chưa có PID, tránh khởi chạy trùng.
find_project_pid() {
  local candidate executable
  local candidates=()
  if [[ -r "$node/cassandra.pid" ]]; then
    candidates+=("$(cat "$node/cassandra.pid")")
  fi
  while IFS= read -r candidate; do candidates+=("$candidate"); done < <(pgrep -f '[o]rg.apache.cassandra.service.CassandraDaemon' || true)
  for candidate in "${candidates[@]}"; do
    [[ "$candidate" =~ ^[1-9][0-9]*$ && "$candidate" -gt 1 && -r "/proc/$candidate/cmdline" ]] || continue
    executable=''
    IFS= read -r -d '' executable < "/proc/$candidate/cmdline" || true
    if [[ "${executable##*/}" == java ]] && grep -aq 'org.apache.cassandra.service.CassandraDaemon' "/proc/$candidate/cmdline" && grep -aqF "$node" "/proc/$candidate/cmdline"; then
      printf '%s' "$candidate"
      return 0
    fi
  done
  return 1
}

case "$action" in
  start|foreground)
    if [[ ! -x "$node/bin/cassandra" ]]; then
      command -v java >/dev/null || { printf 'Java 11 is required.\n' >&2; exit 1; }
      mkdir -p "$runtime"
      archive="apache-cassandra-$version-bin.tar.gz"
      origin="https://downloads.apache.org/cassandra/$version"
      printf 'Downloading Apache Cassandra %s from apache.org...\n' "$version"
      curl --fail --location --retry 3 --max-time 180 --output "$runtime/$archive" "$origin/$archive"
      curl --fail --location --retry 3 --max-time 30 --output "$runtime/$archive.sha256" "$origin/$archive.sha256"
      expected="$(tr -d '[:space:]' < "$runtime/$archive.sha256")"
      printf '%s  %s\n' "$expected" "$runtime/$archive" | sha256sum --check --status
      tar -xzf "$runtime/$archive" -C "$runtime"
      python3 - "$node/conf/cassandra.yaml" <<'PY'
from pathlib import Path
import sys
p = Path(sys.argv[1])
text = p.read_text()
text = text.replace("cluster_name: 'Test Cluster'", "cluster_name: 'AuditFlow Demo'")
p.write_text(text)
PY
      printf 'Download checksum verified. Installation: %s\n' "$node"
    fi
    # Không khởi động trên filesystem chỉ đọc/lỗi I/O rồi báo nhầm là lỗi kết nối API.
    # Probe nằm ngoài các bảng dữ liệu và được dọn ngay khi kiểm tra xong.
    python3 - "$node/data" <<'PY'
from pathlib import Path
import os, sys, tempfile
directory = Path(sys.argv[1])
try:
    directory.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryFile(dir=directory) as probe:
        probe.write(b'auditflow-storage-check')
        probe.flush()
        os.fsync(probe.fileno())
    descriptor = os.open(directory, os.O_RDONLY | os.O_DIRECTORY)
    try:
        os.fsync(descriptor)
    finally:
        os.close(descriptor)
except OSError as error:
    raise SystemExit(f'Cassandra storage is not writable ({directory}): {error}. Check the WSL disk before restarting.')
PY
    if existing_pid="$(find_project_pid)"; then
      printf '%s' "$existing_pid" > "$node/cassandra.pid"
      printf 'The project Cassandra process is already running.\n'
      exit 0
    fi
    export MAX_HEAP_SIZE=768M
    export HEAP_NEWSIZE=192M
    cd "$node"
    if [[ "$action" == 'foreground' ]]; then
      # exec giữ nguyên PID qua wrapper và Java, giúp stop gửi SIGTERM và chờ dừng sạch.
      printf '%s' "$$" > "$node/cassandra.pid"
      exec bin/cassandra -f -p "$node/cassandra.pid"
    fi
    bin/cassandra -p "$node/cassandra.pid"
    printf 'Starting Cassandra; CQL endpoint: 127.0.0.1:9042\n'
    ;;
  status)
    "$node/bin/nodetool" status
    ;;
  cql)
    shift
    exec "$node/bin/cqlsh" 127.0.0.1 9042 "$@"
    ;;
  stop)
    if node_pid="$(find_project_pid)"; then
      kill -TERM "$node_pid"
      printf 'Stopping this project Cassandra process (%s). Data is preserved.\n' "$node_pid"
      for ((attempt=0; attempt<120; attempt++)); do
        if ! kill -0 "$node_pid" 2>/dev/null; then
          rm -f "$node/cassandra.pid"
          printf 'Cassandra stopped cleanly.\n'
          exit 0
        fi
        sleep 0.5
      done
      printf 'Cassandra has not stopped yet; leave WSL running and inspect its logs.\n' >&2
      exit 1
    else
      printf 'No matching project Cassandra process found.\n'
    fi
    ;;
  *) printf 'Usage: %s start|status|cql [cqlsh arguments]|stop\n' "$0" >&2; exit 2 ;;
esac
