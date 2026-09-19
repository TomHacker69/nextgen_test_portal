FROM node:20-alpine

# Hardened minimal sandbox for Node.js
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx \
    && rm -rf /var/cache/apk/*

WORKDIR /sandbox
RUN chown -R node:node /sandbox

USER node
CMD ["node", "/sandbox/solution.js"]
