#!/usr/bin/env bash

node_modules/.bin/markdown README.md -f gfm > .readme.html

awk '
    BEGIN       {p=1}
    /<!-- START -->/   {print;system("cat .readme.html");p=0}
    /<!-- END -->/     {p=1}
    p' index.html > .index.html

mv .index.html index.html
rm .readme.html