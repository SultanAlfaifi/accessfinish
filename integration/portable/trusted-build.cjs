'use strict';
// Operator-owned compiler, outside candidate source and without editable config.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const babel=require('/trusted/node_modules/@babel/core');
const presets=[require.resolve('/trusted/node_modules/@babel/preset-env'),[require.resolve('/trusted/node_modules/babel-preset-minify'),{builtIns:false,mangle:false}]];
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const rows=[];
function visit(dir){for(const d of fs.readdirSync(dir,{withFileTypes:true})){const f=path.join(dir,d.name),st=fs.lstatSync(f);if(st.isSymbolicLink()||(st.isFile()&&st.nlink>1))throw Error('candidate_link_denied');if(d.isDirectory())visit(f);else if(d.isFile()&&/\.js$/i.test(d.name)&&!d.name.endsWith('.min.js')){const input=fs.readFileSync(f,'utf8');const output=babel.transformSync(input,{filename:f,presets,comments:false,babelrc:false,configFile:false}).code+'\n';fs.writeFileSync(f.replace(/\.js$/,'.min.js'),output);rows.push({path:path.relative('/app',f),input_sha256:hash(input),output_sha256:hash(output)});}}}
visit('/app/assets/js');if(!rows.length)throw Error('no_sources');
console.log(JSON.stringify({status:'TRUSTED_BUILD_PASS',candidate_configuration_executed:false,rows}));
