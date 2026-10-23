#!/usr/bin/env bash
set -euo pipefail

version=4.1.12
runtime="${CASSANDRA_RUNTIME_DIR:-${XDG_DATA_HOME:-$HOME/.local/share}/auditflow-cassandra}"
node="$runtime/apache-cassandra-$version"
action="${1:-start}"

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
    if [[ -f "$node/cassandra.pid" ]] && kill -0 "$(cat "$node/cassandra.pid")" 2>/dev/null; then
      printf 'The project Cassandra process is already running.\n'
      exit 0
    fi
    export MAX_HEAP_SIZE=768M
    export HEAP_NEWSIZE=192M
    cd "$node"
    if [[ "$action" == 'foreground' ]]; then
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
    if [[ -f "$node/cassandra.pid" ]]; then
      node_pid="$(cat "$node/cassandra.pid")"
      if [[ -r "/proc/$node_pid/cmdline" ]] && grep -aq 'org.apache.cassandra.service.CassandraDaemon' "/proc/$node_pid/cmdline" && grep -aqF "$node" "/proc/$node_pid/cmdline"; then
        kill -TERM "$node_pid"
        printf 'Stopping this project Cassandra process (%s). Data is preserved.\n' "$node_pid"
      else
        printf 'No matching project Cassandra process found.\n'
      fi
    fi
    ;;
  *) printf 'Usage: %s start|status|cql [cqlsh arguments]|stop\n' "$0" >&2; exit 2 ;;
esac
