#!/bin/bash -e

docker build . \
	-f ./Dockerfile-build \
	-t decred/dcr-netstats

echo ""
echo "==================="
echo "  Build complete"
echo "==================="
echo ""
echo "You can now run dcr-netstats with the following command:"
echo "    docker run -d --rm -p <local port>:3000 decred/dcr-netstats:latest"
echo ""

docker run --rm \
	decred/dcr-netstats:latest
