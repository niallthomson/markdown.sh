FROM amazonlinux:2022

SHELL ["/bin/bash", "-c"]

RUN yum install -y curl tar gzip nodejs npm

RUN npm install -g @niallthomson/wtf@0.0.5

ENTRYPOINT ["wtf"]