FROM node:22-alpine

WORKDIR /app

RUN npm install mcpfs@0.1.0

EXPOSE 24024

ENV PORT=24024

CMD ["npx", "mcpfs"]
