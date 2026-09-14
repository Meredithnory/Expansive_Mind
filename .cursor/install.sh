#!/usr/bin/env bash
# Idempotent Cloud Agent install for Expansive Mind.
# Prepares MongoDB, Node dependencies, and a local .env.local.
# Safe to run repeatedly and against cached/snapshot state.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# --- MongoDB (local dev database) -----------------------------------------
# Installed once; baked into the environment build snapshot on subsequent boots.
if ! command -v mongod >/dev/null 2>&1; then
  echo "Installing MongoDB..."
  . /etc/os-release
  curl -fsSL https://pgp.mongodb.com/server-8.0.asc \
    | sudo gpg -o /usr/share/keyrings/mongodb-server-8.0.gpg --dearmor --yes
  echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-8.0.gpg ] https://repo.mongodb.org/apt/ubuntu ${VERSION_CODENAME}/mongodb-org/8.0 multiverse" \
    | sudo tee /etc/apt/sources.list.d/mongodb-org-8.0.list
  sudo apt-get update -y
  sudo apt-get install -y mongodb-org
else
  echo "MongoDB already installed: $(mongod --version | head -n1)"
fi

# Data directory for the local mongod instance.
sudo mkdir -p /data/db /var/log/mongodb
sudo chown -R "$(id -u):$(id -g)" /data/db /var/log/mongodb

# --- Node dependencies -----------------------------------------------------
echo "Installing Node dependencies..."
npm install

# --- Local environment file ------------------------------------------------
# Never overwrite an existing .env.local (may hold real keys). Seed a minimal
# local-dev config from .env.example when absent so the app can boot.
if [ ! -f .env.local ]; then
  echo "Seeding .env.local from .env.example..."
  cp .env.example .env.local

  set_env() {
    local key="$1" value="$2"
    if grep -q "^${key}=" .env.local; then
      # Use a non-slash delimiter; values may contain slashes.
      sed -i "s|^${key}=.*|${key}=${value}|" .env.local
    else
      printf '%s=%s\n' "$key" "$value" >> .env.local
    fi
  }

  set_env MONGODB_URI "mongodb://127.0.0.1:27017/expansive_mind"
  set_env JWT_SECRET "$(openssl rand -hex 32)"
  set_env RATE_LIMIT_SECRET "$(openssl rand -hex 32)"
  set_env APP_URL "http://localhost:3000"
  set_env CONTENT_ACCESS_MODE "legacy"
  set_env NCBI_TOOL "ExpansiveMind"
else
  echo ".env.local already present; leaving it untouched."
fi

echo "Install complete."
