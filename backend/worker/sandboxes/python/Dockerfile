FROM python:3.11-alpine

# Hardened minimal sandbox for Python 3.11
RUN adduser -D -u 1000 sandboxuser \
    && rm -rf /root/.cache /var/cache/apk/* /usr/local/bin/pip /usr/local/bin/pip3

WORKDIR /sandbox
RUN chown -R sandboxuser:sandboxuser /sandbox

USER sandboxuser
CMD ["python3", "/sandbox/solution.py"]
