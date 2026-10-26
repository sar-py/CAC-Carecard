const fs=require('fs'),path=require('path'),esbuild=require('esbuild');
esbuild.buildSync({entryPoints:[path.join(__dirname,'../cloud/auth.js')],outfile:path.join(__dirname,'../public/auth.bundle.js'),bundle:true,minify:true,format:'iife',target:['safari16','chrome109'],legalComments:'eof'});
console.log('Built cloud sign-in client. Only /api/config supplies public Supabase configuration; no private keys are bundled.');
