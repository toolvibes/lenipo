# PostgreSQL 17 with pgvector for semantic search. The official Alpine image plus the extension,
# so existing data directories of postgres:17-alpine keep working (same C library and collation).
FROM postgres:17-alpine

ARG PGVECTOR_VERSION=v0.8.7

RUN apk add --no-cache --virtual .build-deps git build-base \
  && git clone --depth 1 --branch "$PGVECTOR_VERSION" https://github.com/pgvector/pgvector.git /tmp/pgvector \
  && cd /tmp/pgvector \
  # Portable code (no -march=native) and no LLVM bitcode, which would need clang.
  && make OPTFLAGS="" with_llvm=no \
  && make install with_llvm=no \
  && cd / && rm -rf /tmp/pgvector \
  && apk del .build-deps
