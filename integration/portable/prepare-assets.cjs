'use strict';
// Trusted packaging only. Never load upstream Gulp/Babel configuration or scripts.
const fs = require('node:fs'), path = require('node:path');
const sass = require('/app/node_modules/sass');
const mappings = {
  bootstrap: ['bootstrap/dist/js/bootstrap.min.js', 'bootstrap/dist/css/bootstrap.min.css'],
  '@fortawesome-fontawesome-free': ['@fortawesome/fontawesome-free/js/fontawesome.min.js', '@fortawesome/fontawesome-free/js/solid.min.js'],
  cookieconsent: ['cookieconsent/build/cookieconsent.min.js', 'cookieconsent/build/cookieconsent.min.css'],
  fullcalendar: ['fullcalendar/index.global.min.js'], 'fullcalendar-moment': ['@fullcalendar/moment/index.global.min.js'],
  jquery: ['jquery/dist/jquery.min.js'], 'jquery-jeditable': ['jquery-jeditable/dist/jquery.jeditable.min.js'],
  moment: ['moment/min/moment.min.js'], 'moment-timezone': ['moment-timezone/builds/moment-timezone-with-data.min.js'],
  '@popperjs-core': ['@popperjs/core/dist/umd/popper.min.js'], select2: ['select2/dist/js/select2.min.js', 'select2/dist/css/select2.min.css'],
  'tippy.js': ['tippy.js/dist/tippy-bundle.umd.min.js'], trumbowyg: ['trumbowyg/dist/trumbowyg.min.js', 'trumbowyg/dist/ui/trumbowyg.min.css'],
  'trumbowyg/ui': ['trumbowyg/dist/ui/icons.svg'], flatpickr: ['flatpickr/dist/flatpickr.min.js', 'flatpickr/dist/flatpickr.min.css'],
};
for (const [folder, files] of Object.entries(mappings)) {
  const destination = '/app/assets/vendor/' + folder; fs.mkdirSync(destination, {recursive: true});
  for (const file of files) fs.copyFileSync('/app/node_modules/' + file, path.join(destination, path.basename(file)));
}
fs.copyFileSync('/app/node_modules/flatpickr/dist/themes/material_green.css', '/app/assets/vendor/flatpickr/material_green.min.css');
function compile(dir) {
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) compile(file);
    else if (entry.name.endsWith('.scss') && !entry.name.startsWith('_')) {
      const result = sass.compile(file, {style: 'compressed', quietDeps: true, silenceDeprecations: ['legacy-js-api', 'color-functions', 'global-builtin', 'import']});
      fs.writeFileSync(file.replace(/\.scss$/, '.min.css'), result.css);
      fs.writeFileSync(file.replace(/\.scss$/, '.css'), result.css);
    }
  }
}
compile('/app/assets/css');
