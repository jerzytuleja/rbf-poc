# rbf-poc

npm run start

generate pbf files with usage of command:

docker run -it --rm -v c:/projects/meteo/roadmaster/map/rbf:/data igac/tippecanoe:1.34.3 tippecanoe -e /data/output --force -l geojsonLayer -zg --preserve-input-order /data/merged.json

side note: with current version of tiles, You can test with roads 1149, 1150, 1151 etc. From unnown reason tippecanoe didnt generate properly metadata and full list of routes.