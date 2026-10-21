ARG NODE_IMAGE=node:22-bookworm-slim
ARG PHP_IMAGE=php:8.4.24-cli-bookworm
ARG COMPOSER_IMAGE=composer:2
ARG BROWSER_IMAGE=mcr.microsoft.com/playwright:v1.62.1-noble

FROM ${NODE_IMAGE} AS assets
ADD integration/portable/easyappointments-source.tar.gz /app/
WORKDIR /app
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY integration/portable/prepare-assets.cjs integration/portable/trusted-build.cjs /trusted/
RUN ln -s /app/node_modules /trusted/node_modules && node /trusted/prepare-assets.cjs && node /trusted/trusted-build.cjs

FROM ${COMPOSER_IMAGE} AS composer

FROM ${PHP_IMAGE} AS php
RUN apt-get update && apt-get install -y --no-install-recommends libpng-dev libjpeg62-turbo-dev libonig-dev libxml2-dev libcurl4-openssl-dev unzip && docker-php-ext-configure gd --with-jpeg && docker-php-ext-install -j2 mysqli gd mbstring simplexml curl && rm -rf /var/lib/apt/lists/*
COPY --from=composer /usr/bin/composer /usr/local/bin/composer
COPY --from=assets /app/application /opt/original/application
COPY --from=assets /app/system /opt/original/system
COPY --from=assets /app/assets /opt/original/assets
COPY --from=assets /app/index.php /app/composer.json /app/composer.lock /app/LICENSE /opt/original/
WORKDIR /opt/original
RUN composer install --no-dev --no-scripts --no-plugins --no-interaction --prefer-dist --optimize-autoloader
COPY integration/portable/trusted-router.php integration/portable/select-evaluator.php /trusted/
RUN mkdir -p /app /seed /eval-config /run/mysqld && chmod -R a+rX /opt/original /trusted
USER 1000:1000
WORKDIR /app

FROM ${NODE_IMAGE} AS compiler
COPY --from=assets /app/node_modules /trusted/node_modules
COPY integration/portable/trusted-build.cjs integration/portable/apply-patch.cjs /trusted/
COPY lib/repair.cjs /trusted/repair.cjs
USER 1000:1000
WORKDIR /app

FROM ${BROWSER_IMAGE} AS browser
WORKDIR /trusted
RUN npm init -y && npm install --ignore-scripts --no-audit --no-fund --save-exact playwright@1.62.1
COPY integration/portable/container-keyboard-booking-worker.cjs integration/portable/container-booking-pilot-observer.cjs integration/portable/booking-keyboard-macros.cjs integration/portable/case-worker.cjs integration/portable/regression-controls.cjs /trusted/
RUN mkdir -p /artifacts && chmod a+rX /trusted
USER 1000:1000
WORKDIR /tmp
