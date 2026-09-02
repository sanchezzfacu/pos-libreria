FROM node:20-slim

# Instalación de herramientas del sistema
RUN apt-get update \
  && apt-get install -y --no-install-recommends poppler-utils \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

# Usar el puerto inyectado o 4000 por defecto
ENV PORT=4000
EXPOSE ${PORT}

CMD ["node", "src/server.js"]