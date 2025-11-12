# Use a lightweight Node image
FROM node:20-alpine

# Create app directory
WORKDIR /app

# Set production env
ENV NODE_ENV=production

# Install dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy source
COPY src ./src

# Expose and run
EXPOSE 3000
CMD ["node", "src/index.js"]
