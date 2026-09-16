FROM alpine:3.19

# Minimal C++ GCC runtime
RUN apk add --no-cache g++ musl-dev \
    && adduser -D -u 1000 sandboxuser \
    && rm -rf /var/cache/apk/*

WORKDIR /sandbox
RUN chown -R sandboxuser:sandboxuser /sandbox

USER sandboxuser
CMD ["/tmp/solution"]
