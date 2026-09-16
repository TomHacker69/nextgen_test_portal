FROM openjdk:21-slim

# Minimal Java 21 runtime
RUN useradd -u 1000 -m sandboxuser \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /sandbox
RUN chown -R sandboxuser:sandboxuser /sandbox

USER sandboxuser
CMD ["java", "-cp", "/tmp", "Solution"]
