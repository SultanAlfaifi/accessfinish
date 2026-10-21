'use strict';
require('../lib/fixture.cjs').setup().catch(error => { console.error(error.message); process.exitCode = 1; });
