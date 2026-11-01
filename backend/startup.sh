#!/bin/sh
set -eu
cd /home/site/wwwroot
release=$(node -p "require('./build-info.json').commit")
modules="/tmp/personalshop-$release/node_modules"
if [ ! -f "$modules/.personalshop-ready" ]; then
  mkdir -p "$modules"
  tar -xzf node_modules.tar.gz -C "$modules"
  touch "$modules/.personalshop-ready"
fi
if [ -L node_modules ]; then
  unlink node_modules
elif [ -d node_modules ]; then
  mv node_modules "node_modules.previous-$release"
fi
ln -s "$modules" node_modules
exec node server.js
