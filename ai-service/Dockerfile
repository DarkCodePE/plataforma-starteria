FROM python:3.11-slim
ARG STARTERIA_RELEASE_SHA=unknown
ARG STARTERIA_RELEASE_VERSION=0.1.0
LABEL org.opencontainers.image.revision=$STARTERIA_RELEASE_SHA \
      org.opencontainers.image.version=$STARTERIA_RELEASE_VERSION \
      org.opencontainers.image.source="https://github.com/DarkCodePE/plataforma-starteria"
ENV STARTERIA_RELEASE_SHA=$STARTERIA_RELEASE_SHA \
    STARTERIA_RELEASE_VERSION=$STARTERIA_RELEASE_VERSION
WORKDIR /app
COPY pyproject.toml .
RUN pip install .
COPY . .
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]
