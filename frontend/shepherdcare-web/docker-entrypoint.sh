#!/bin/sh
# Write runtime config before nginx starts so the browser gets the real API key.
echo "window.GOOGLE_MAPS_API_KEY = \"${GOOGLE_MAPS_API_KEY:-}\";" > /usr/share/nginx/html/config.js
exec nginx -g "daemon off;"
