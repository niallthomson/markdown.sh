FROM node:16

ARG version

SHELL ["/bin/bash", "-c"]

RUN npm install -g @niallthomson/markdown-sh@$version

ENTRYPOINT ["markdown-sh"]