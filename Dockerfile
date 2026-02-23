FROM node:22-bookworm

WORKDIR /home/wtsadmin/myapp

RUN npm install -g pnpm
RUN apt-get update && apt-get install -y python3 make g++

CMD bash -c "\
  echo 'Fixing permissions...' && \
  mkdir -p logs dist && \
  chown -R node:node /home/wtsadmin/myapp 2>/dev/null || true && \
  echo 'Starting app...' && \
  su node -c 'pnpm start' \
"
