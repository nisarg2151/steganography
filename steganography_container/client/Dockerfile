FROM python:3.7-alpine
RUN mkdir -p /nisarg/app/client
WORKDIR /nisarg/app/client

COPY ./steg-app /nisarg/app/client
EXPOSE 8000
CMD python -m http.server 8000
