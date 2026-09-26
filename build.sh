#!/bin/sh
# Build the zip to upload to the Chrome Web Store: dist/document-zoom-<version>.zip
set -e
cd "$(dirname "$0")"
version=$(sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' extension/manifest.json)
mkdir -p dist
out="dist/document-zoom-$version.zip"
rm -f "$out"
(cd extension && zip -qr "../$out" . -x '.*')
echo "$out"
