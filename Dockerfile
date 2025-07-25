# Use Node.js 18 Alpine for smaller image size
FROM node:18-alpine

# Install system dependencies for canvas and tensorflow
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    jpeg-dev \
    cairo-dev \
    giflib-dev \
    pango-dev \
    libtool \
    autoconf \
    automake \
    pkgconfig \
    pixman-dev \
    pkgconfig \
    build-base \
    libpng-dev \
    pango-dev \
    jpeg-dev \
    giflib-dev \
    librsvg-dev

# Set working directory
WORKDIR /app

# Copy package files
COPY server/package*.json ./server/
COPY client/package*.json ./client/

# Install dependencies
RUN cd server && npm install
RUN cd client && npm install

# Copy source code
COPY server/ ./server/
COPY client/ ./client/

# Build the server
RUN cd server && npm run build

# Create models directory
RUN mkdir -p server/models

# Expose ports
EXPOSE 5001 3000

# Create a startup script
RUN echo '#!/bin/sh\n\
cd /app/server && npm start &\n\
cd /app/client && npm start\n\
wait' > /app/start.sh && chmod +x /app/start.sh

# Start both server and client
CMD ["/app/start.sh"] 