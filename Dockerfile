# Use an official Node.js runtime as a parent image
FROM node:18

# Install necessary dependencies, including curl
RUN apt-get update && apt-get install -y \
    curl \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# Install AWS CLI
RUN curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip" \
    && unzip awscliv2.zip \
    && ./aws/install \
    && rm -rf awscliv2.zip ./aws

# Set the working directory in the container
WORKDIR /app

# Copy package.json and package-lock.json/yarn.lock
COPY package*.json ./ 

# Copy the rest of your application code to the container
COPY . .

# Install app dependencies
RUN npm install

# Expose the port (optional, only if your service needs to communicate via a specific port)
EXPOSE 4000

# Run the application
CMD ["node", "app.js"]