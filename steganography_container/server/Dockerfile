# You should always specify a full version here to ensure all of your developers
# are running the same version of Node.
FROM node:10-alpine
RUN mkdir -p /nisarg/app/server
# The base node image sets a very verbose log level.
ENV NPM_CONFIG_LOGLEVEL warn

WORKDIR /nisarg/app/server
# Copy all local files into the image.
COPY ./steg-ws /nisarg/app/server

# Tell Docker about the port we'll run on.
EXPOSE 1234

# Install dependencies to run the application.
RUN npm install

# Set the command to start the node server.
CMD ["node","index.js", "1234"]
