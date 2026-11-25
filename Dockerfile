# Release builds must override these patch tags with verified tag@sha256 refs.
# infra/build-image.sh enforces digest pins and builds an exact Git archive.
ARG NODE_IMAGE=node:22.23.5-bookworm-slim
ARG CADDY_IMAGE=caddy:2.11.9-alpine
FROM ${NODE_IMAGE} AS build
ARG NODE_IMAGE
RUN printf '%s\n' "$NODE_IMAGE" | grep -Eq '^node:22\.23\.5-bookworm-slim@sha256:[a-f0-9]{64}$'
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run import:openings -- --check && npm run build
ARG VCS_REF
RUN node -e 'const fs = require("node:fs"); const revision = process.env.VCS_REF; if (!/^[a-f0-9]{40}$/.test(revision || "")) throw Error("VCS_REF must be a full Git SHA"); const data = JSON.parse(fs.readFileSync("src/openings/data.json", "utf8")); fs.writeFileSync("dist/release.json", JSON.stringify({ version: "0.1.0", revision, datasetCommit: data.source.commit }) + "\n");'

FROM ${CADDY_IMAGE} AS runtime
ARG CADDY_IMAGE
ARG NODE_IMAGE
ARG VCS_REF
LABEL lab.node-base="${NODE_IMAGE}" lab.caddy-base="${CADDY_IMAGE}" \
      org.opencontainers.image.title="ChessOpening Lab" \
      org.opencontainers.image.version="0.1.0" \
      org.opencontainers.image.source="https://github.com/Babuuum/ChessOpeningLab" \
      org.opencontainers.image.revision="${VCS_REF}"
# The upstream binary has a low-port capability; this image only listens on 8080.
RUN printf '%s\n' "$CADDY_IMAGE" | grep -Eq '^caddy:2\.11\.9-alpine@sha256:[a-f0-9]{64}$' && \
    setcap -r /usr/bin/caddy && \
    rm -rf /usr/share/caddy/* && \
    mkdir -p /config/caddy /data/caddy && \
    chown -R 10001:10001 /config /data
COPY --from=build /app/dist/ /usr/share/caddy/
COPY --from=build /app/data/chess-openings/COPYING.txt /usr/share/licenses/chess-openings/COPYING.txt
COPY --from=build /app/data/chess-openings/source.lock.json /usr/share/licenses/chess-openings/source.lock.json
COPY infra/Caddyfile /etc/caddy/Caddyfile
COPY infra/check-runtime-tools.sh /usr/local/bin/check-runtime-tools
RUN sh /usr/local/bin/check-runtime-tools
USER 10001:10001
WORKDIR /usr/share/caddy
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD ["curl", "--fail", "--silent", "--show-error", "--max-time", "3", "http://127.0.0.1:8080/healthz"]
CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
