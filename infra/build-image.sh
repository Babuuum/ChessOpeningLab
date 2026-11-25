#!/bin/sh
# Builds only; never starts containers, pushes images or changes Git.
set -eu
cd "$(dirname "$0")/.."
if [ "$#" -ne 1 ]; then
    echo "Usage: NODE_IMAGE=tag@sha256:... CADDY_IMAGE=tag@sha256:... TARGET_PLATFORM=linux/amd64 sh infra/build-image.sh FULL_COMMIT_SHA" >&2
    exit 2
fi
revision=$1
if ! printf '%s\n' "$revision" | grep -Eq '^[a-f0-9]{40}$'; then
    echo "A full 40-character Git commit SHA is required" >&2; exit 2
fi
if [ -n "$(git status --porcelain --untracked-files=all)" ]; then
    echo "Release build refused: working tree/index must be clean" >&2; exit 1
fi
if [ "$(git rev-parse HEAD)" != "$revision" ]; then
    echo "Release build refused: check out the specified accepted commit first" >&2; exit 1
fi
for path in Dockerfile infra/Caddyfile frontend/src/openings/data.json frontend/data/chess-openings/source.lock.json; do
    git cat-file -e "$revision:$path"
done
if ! printf '%s\n' "${NODE_IMAGE:-}" | grep -Eq '^node:22\.23\.5-bookworm-slim@sha256:[a-f0-9]{64}$' ||
   ! printf '%s\n' "${CADDY_IMAGE:-}" | grep -Eq '^caddy:2\.11\.9-alpine@sha256:[a-f0-9]{64}$'; then
    echo "Set verified digest-pinned NODE_IMAGE and CADDY_IMAGE; see docs/HOME_RELEASE.md" >&2; exit 2
fi
case "${TARGET_PLATFORM:-}" in
    linux/amd64|linux/arm64) ;;
    *) echo "Set TARGET_PLATFORM to the confirmed server architecture (linux/amd64 or linux/arm64)" >&2; exit 2 ;;
esac
docker info >/dev/null
image_tag="chessopening-lab:git-$revision"
if docker image inspect "$image_tag" >/dev/null 2>&1; then
    echo "Refusing to overwrite an existing commit image: $image_tag" >&2; exit 1
fi
task_build_dir=$(mktemp -d "${TMPDIR:-/tmp}/chessopening-build.XXXXXX")
trap 'rm -rf "$task_build_dir"' EXIT HUP INT TERM
git archive --format=tar --output="$task_build_dir/source.tar" "$revision"
mkdir "$task_build_dir/context"
tar -xf "$task_build_dir/source.tar" -C "$task_build_dir/context"
docker build --pull --platform "$TARGET_PLATFORM" \
    --build-arg NODE_IMAGE="$NODE_IMAGE" --build-arg CADDY_IMAGE="$CADDY_IMAGE" \
    --build-arg VCS_REF="$revision" --tag "$image_tag" "$task_build_dir/context"
docker image inspect --format '{{.Id}}' "$image_tag"
