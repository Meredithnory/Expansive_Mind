#!/usr/bin/env bash
# Per-boot startup for Expansive Mind: bring up the local mongod and wait until
# it accepts connections. Idempotent — a running instance is reused.
set -euo pipefail

ping_mongo() {
  mongosh --quiet --host 127.0.0.1 --port 27017 \
    --eval 'db.runCommand({ ping: 1 })' >/dev/null 2>&1
}

if ping_mongo; then
  echo "mongod already running."
  exit 0
fi

sudo mkdir -p /data/db /var/log/mongodb
sudo chown -R "$(id -u):$(id -g)" /data/db /var/log/mongodb 2>/dev/null || true

echo "Starting mongod..."
mongod --dbpath /data/db --bind_ip 127.0.0.1 --port 27017 \
  --fork --logpath /var/log/mongodb/mongod.log

for _ in $(seq 1 30); do
  if ping_mongo; then
    echo "mongod ready on 127.0.0.1:27017."
    exit 0
  fi
  sleep 1
done

echo "mongod failed to become ready; see /var/log/mongodb/mongod.log" >&2
exit 1
