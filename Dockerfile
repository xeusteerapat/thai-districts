# Use Node.js LTS version as base image
FROM node:lts-bullseye-slim

FROM mcr.microsoft.com/playwright:v1.42.1-jammy

# Set working directory inside the container
WORKDIR /usr/src/app

ENV PATH /usr/src/app/node_modules/.bin:$PATH

# Copy package.json and package-lock.json
COPY pnpm-lock.yaml package.json ./

RUN npm install -g pnpm

# Install dependencies
RUN pnpm install --production

RUN pnpm install playwright \
  && pnpm exec playwright install

# Copy built TypeScript files to the container
COPY ./ ./

RUN pnpm run build

# Expose the port your app runs on
EXPOSE 3002

# Command to run your app using Node.js
CMD ["pnpm", "start"]
