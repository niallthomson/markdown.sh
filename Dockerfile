FROM amazonlinux:2022

ARG version

SHELL ["/bin/bash", "-c"]

RUN yum install -y curl tar gzip nodejs npm

RUN npm install -g @niallthomson/markdown-sh@$version

ENTRYPOINT ["markdown-sh"]