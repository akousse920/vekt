#!/bin/sh
# Installed at /opt/vekt/deploy-kousse.sh as the deploy key's forced command.
set -eu

expected=${SSH_ORIGINAL_COMMAND:-}
case "$expected" in
  ''|*[!0-9a-f]*) exit 2 ;;
esac
[ "${#expected}" -eq 40 ] || exit 2

cd /opt/vekt
./deploy.sh
revision=$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' vekt-app)
if [ "$revision" != "$expected" ]; then
  echo "Expected revision $expected, running $revision" >&2
  exit 1
fi
echo "Running revision $revision"
